import { existsSync } from 'node:fs';
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { StructuredLogger } from '@cop1/observability';
import { EventBus } from '@cop1/shared-kernel';
import {
  AgentSdkSessionAdapter,
  AgentSdkSupervisorAdapter,
  type BMADSessionPort,
  CLAUDE_STATUS_EVENT,
  ClaudeResumeSessionAdapter,
  DefaultModelTierRouter,
  ExchangeHistoryWriter,
  SessionInteractionCollector,
  SupervisorService,
  WorktreeService,
} from '@cop1/sprint-core';
import {
  type BMADCommandRunner,
  type OrchestratorMode,
  OrchestratorService,
} from '../../features/orchestrator/application/OrchestratorService.js';
import { SupervisorPlaybookLoader } from '../../features/orchestrator/application/SupervisorPlaybookLoader.js';
import { RunBudget } from '../../features/orchestrator/domain/RunBudget.js';
import type { SupervisorPlaybook } from '../../features/orchestrator/domain/SupervisorPlaybook.js';
import { createAbortFilePredicate } from '../../features/orchestrator/infrastructure/AbortFile.js';
import { CommandVerificationGate } from '../../features/orchestrator/infrastructure/CommandVerificationGate.js';
import { createDefaultBMADCommandRunner } from '../../features/orchestrator/infrastructure/DefaultBMADCommandRunner.js';
import { GitCommitAnchor } from '../../features/orchestrator/infrastructure/GitCommitAnchor.js';
import { GitWorkspaceInspector } from '../../features/orchestrator/infrastructure/GitWorkspaceInspector.js';
import { createInterCommandApprovalResolver } from '../../features/orchestrator/infrastructure/InterCommandApprovalResolver.js';
import { stubBMADCommandRunner } from '../../features/orchestrator/infrastructure/testing/StubBMADCommandRunner.js';

export interface OrchestratorRunCliOptions {
  playbook?: string;
  epic: string;
  stepByStep?: boolean;
  abortOnEscalation?: boolean;
  projectRoot?: string;
  runner?: 'default' | 'stub';
}

/**
 * ADR-018 default tool denylist forwarded to the BMAD session SDK adapter.
 * Paired with the adapter's defensive `canUseTool` guard (belt-and-braces).
 */
const DEFAULT_DISALLOWED_TOOLS = ['Bash(rm *)', 'Bash(git reset --hard *)', 'Bash(git clean *)'];

export async function orchestratorRunCommand(
  options: OrchestratorRunCliOptions,
  overrides: { runner?: BMADCommandRunner } = {},
): Promise<void> {
  if (!options.epic) {
    console.error('Missing required flag: --epic <id>');
    process.exitCode = 1;
    return;
  }

  const projectRoot = options.projectRoot ?? process.cwd();
  const playbookPath = options.playbook ?? join(projectRoot, 'supervisor-playbook.md');

  const loader = new SupervisorPlaybookLoader({ projectRoot });
  let playbook: SupervisorPlaybook;
  try {
    playbook = await loader.load(playbookPath);
  } catch (err) {
    console.error('Failed to load playbook:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
    return;
  }

  const mode: OrchestratorMode = options.abortOnEscalation
    ? 'abort-on-escalation'
    : options.stepByStep
      ? 'step-by-step'
      : 'normal';

  const eventBus = new EventBus();
  const resolver = createInterCommandApprovalResolver();
  const gate = async (ctx: { storyKey: string; nextCommand: string }) =>
    resolver({ phase: 'inter', label: `${ctx.storyKey}:${ctx.nextCommand}` });

  const logDir = join(projectRoot, '.cop1');
  await mkdir(logDir, { recursive: true });
  const logPath = join(logDir, `sprint-log-${new Date().toISOString().slice(0, 10)}.jsonl`);
  const autoDecisionLogger = (payload: Record<string, unknown>) => {
    void appendFile(logPath, `${JSON.stringify(payload)}\n`, 'utf-8');
  };

  // Budget / kill-switch: token cap, wall-clock deadline, and external abort file.
  const budget = new RunBudget({
    maxTokens: parseEnvInt('COP1_MAX_TOKENS'),
    deadlineMs: parseEnvMinToMs('COP1_DEADLINE_MIN'),
    externalAbort: createAbortFilePredicate(join(logDir, 'abort')),
  });
  // `completed` and `failed` are mutually exclusive per command execution, so
  // crediting the budget on both paths records tokens for failed commands too
  // without any risk of double-counting a single run.
  const creditBudget = (p: unknown) => {
    const tokens = (p as { tokensUsed?: unknown }).tokensUsed;
    if (typeof tokens === 'number') budget.recordTokens(tokens);
  };
  eventBus.on('session.workflow.completed', creditBudget);
  eventBus.on('session.workflow.failed', creditBudget);

  // Surface Claude availability: a transient blockage (overloaded / rate-limit /
  // 5xx / network) is retried with backoff inside the adapter and reported here,
  // so an operator sees a temporary degradation instead of a silent stall. The
  // web traffic-light panel will consume the same event once Story A lands.
  eventBus.on(CLAUDE_STATUS_EVENT, (p) => {
    const e = p as { status?: string; attempt?: number; detail?: string; storyId?: string };
    autoDecisionLogger({
      ts: new Date().toISOString(),
      event: 'claude-status',
      status: e.status,
      attempt: e.attempt,
      storyId: e.storyId,
      detail: e.detail,
    });
    if (e.status === 'degraded' || e.status === 'unavailable') {
      console.warn(
        `[claude:${e.status}] attempt ${e.attempt}${e.storyId ? ` (${e.storyId})` : ''}: ${e.detail ?? ''}`,
      );
    }
  });

  try {
    const runner = overrides.runner ?? resolveRunner(options, projectRoot, eventBus);
    // ADR-018 — opt-in per-story git worktree isolation. Off by default to keep
    // the V1.1 behavior; enable with COP1_WORKTREE_ISOLATION=1.
    const worktreePort =
      process.env.COP1_WORKTREE_ISOLATION === '1' ? new WorktreeService() : undefined;
    const svc = new OrchestratorService(
      runner,
      eventBus,
      gate,
      autoDecisionLogger,
      budget,
      worktreePort,
    );
    const result = await svc.run({ playbook, epicId: options.epic, projectRoot, mode });
    if (result.aborted) {
      process.exitCode = 3;
    }
    console.log(
      `Orchestrator finished: ${result.storiesProcessed.length} stories, escalated=${result.escalated}, aborted=${result.aborted}`,
    );
  } catch (err) {
    console.error('Orchestrator runtime error:', err);
    process.exitCode = 2;
  }
}

function resolveRunner(
  options: OrchestratorRunCliOptions,
  projectRoot: string,
  eventBus: EventBus,
): BMADCommandRunner {
  if (options.runner === 'stub') {
    if (process.env.COP1_ALLOW_STUB_RUNNER !== '1') {
      throw new Error(
        '--runner stub produces fake success output and would re-open the gap EA13 ' +
          'was designed to close. Set COP1_ALLOW_STUB_RUNNER=1 to explicitly opt in ' +
          '(tests / smoke only — never in production).',
      );
    }
    console.warn(
      '[WARN] Orchestrator runner: stub (--runner stub, COP1_ALLOW_STUB_RUNNER=1). ' +
        'No real BMAD commands will be invoked. Output is fiction — do not treat as a real sprint.',
    );
    return stubBMADCommandRunner;
  }

  // Pre-flight: ensure _bmad/ exists at projectRoot before building the real runner.
  const bmadDir = join(projectRoot, '_bmad');
  if (!existsSync(bmadDir)) {
    throw new Error(
      `No BMAD installation found at ${bmadDir}. The orchestrator requires BMAD workflows to execute real sprint commands. Install BMAD or use --runner stub (with COP1_ALLOW_STUB_RUNNER=1) for testing.`,
    );
  }

  // Default: real BMAD session-backed runner. Wiring mirrors sprint-run.ts.
  const structuredLogger = new StructuredLogger(projectRoot);
  // EA14-S2: Use SessionInteractionCollector (extends SessionLogger) so that
  // interactions are captured for the ExchangeHistoryWriter Track 2 output.
  const interactionCollector = new SessionInteractionCollector(structuredLogger, eventBus);
  const supervisorAdapter = new AgentSdkSupervisorAdapter();
  const supervisorService = new SupervisorService(supervisorAdapter, interactionCollector);
  const questionHandler = supervisorService.createQuestionHandler();

  // Per-session USD ceiling: forwarded to the SDK adapter's native maxBudgetUsd.
  const parsedUsd = Number.parseFloat(process.env.COP1_MAX_USD_PER_SESSION ?? '');
  const maxBudgetUsd = Number.isFinite(parsedUsd) && parsedUsd > 0 ? parsedUsd : undefined;

  const adapterChoice = (process.env.COP1_BMAD_ADAPTER ?? '').trim();
  let sessionPort: BMADSessionPort;
  if (adapterChoice === 'resume') {
    console.log('BMAD adapter: claude --resume fallback (COP1_BMAD_ADAPTER=resume)');
    sessionPort = new ClaudeResumeSessionAdapter(eventBus, { questionHandler });
  } else {
    if (adapterChoice && adapterChoice !== 'sdk') {
      console.warn(`Unknown COP1_BMAD_ADAPTER value '${adapterChoice}', falling back to 'sdk'`);
    }
    sessionPort = new AgentSdkSessionAdapter(eventBus, {
      questionHandler,
      modelRouter: new DefaultModelTierRouter(),
      disallowedTools: DEFAULT_DISALLOWED_TOOLS,
      ...(maxBudgetUsd !== undefined && { maxBudgetUsd }),
    });
  }

  // EA14-S2: Wire ExchangeHistoryWriter for Track 2 per-session markdown files.
  const exchangeHistoryWriter = new ExchangeHistoryWriter(projectRoot);

  // Commit anchor (EA14-S3) — opt-in: commits verified per-story work as a
  // durable rollback unit. Off by default (auto-commit blast radius); enable
  // with COP1_COMMIT_ANCHOR=1.
  const commitAnchor = process.env.COP1_COMMIT_ANCHOR === '1' ? new GitCommitAnchor() : undefined;

  return createDefaultBMADCommandRunner({
    sessionPort,
    supervisorService,
    exchangeHistoryWriter,
    interactionCollector,
    verificationGate: new CommandVerificationGate(),
    workspaceInspection: new GitWorkspaceInspector(),
    ...(commitAnchor ? { commitAnchor } : {}),
  });
}

/**
 * Reads an env var as a strictly-positive integer. Returns undefined if absent,
 * NaN, or <= 0 — a zero/negative budget cap is treated as "no cap" rather than a
 * cap that would trip immediately (or never).
 */
export function parseEnvInt(name: string): number | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const value = Number.parseInt(raw, 10);
  return Number.isNaN(value) || value <= 0 ? undefined : value;
}

/** Reads an env var as minutes and converts to milliseconds; undefined if absent or <= 0. */
export function parseEnvMinToMs(name: string): number | undefined {
  const minutes = parseEnvInt(name);
  return minutes === undefined ? undefined : minutes * 60_000;
}
