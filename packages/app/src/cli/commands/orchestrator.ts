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
  type OrchestratorRunResult,
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

  try {
    const handle = await buildOrchestratorRun({
      playbook,
      epic: options.epic,
      mode,
      projectRoot,
      eventBus: new EventBus(),
      runner: overrides.runner,
      runnerChoice: options.runner,
    });
    const result = await handle.run();
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

export interface BuildOrchestratorRunOptions {
  /** Playbook already loaded by the caller. */
  playbook: SupervisorPlaybook;
  epic: string;
  mode: OrchestratorMode;
  projectRoot: string;
  /** Injected — the run emits on THIS bus (CLI: a fresh bus; daemon: a TaggingEventBus). */
  eventBus: EventBus;
  /** Explicit runner override (tests / daemon); else resolveRunner(...). */
  runner?: BMADCommandRunner;
  /** CLI `--runner` flag (`default`/`stub`) forwarded to resolveRunner when no explicit runner. */
  runnerChoice?: 'default' | 'stub';
  /** Optional caps; when provided, override the COP1_* env equivalents. */
  caps?: { maxTokens?: number; deadlineMin?: number; maxUsdPerSession?: number };
}

export interface OrchestratorRunHandle {
  run(): Promise<OrchestratorRunResult>;
}

/**
 * Builds the orchestrator run wiring (mode-aware gate, budget/kill-switch, event
 * listeners, runner resolution, OrchestratorService construction) WITHOUT
 * touching `process.exitCode` and WITHOUT printing the completion summary —
 * those stay in the CLI command. Reused by the daemon's in-process run adapter.
 */
export async function buildOrchestratorRun(
  opts: BuildOrchestratorRunOptions,
): Promise<OrchestratorRunHandle> {
  const { playbook, epic, mode, projectRoot, eventBus, caps } = opts;

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
  // Explicit `caps` override the COP1_* env equivalents (deadlineMin → ms).
  const budget = new RunBudget({
    maxTokens: caps?.maxTokens ?? parseEnvInt('COP1_MAX_TOKENS'),
    deadlineMs:
      caps?.deadlineMin !== undefined && caps.deadlineMin > 0
        ? caps.deadlineMin * 60_000
        : parseEnvMinToMs('COP1_DEADLINE_MIN'),
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
  // web traffic-light panel consumes the same event over SSE.
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

  const runner =
    opts.runner ??
    resolveRunner({ runner: opts.runnerChoice }, projectRoot, eventBus, caps?.maxUsdPerSession);
  // ADR-018 — opt-in per-story git worktree isolation. Off by default to keep
  // the V1.1 behavior; enable with COP1_WORKTREE_ISOLATION=1.
  const worktreePort =
    process.env.COP1_WORKTREE_ISOLATION === '1' ? new WorktreeService() : undefined;

  // ADR-020 — opt-in per-story budget. When neither env is set, pass undefined
  // so the run behaves exactly as before (no per-story budget).
  const storyMaxTokens = parseEnvInt('COP1_MAX_TOKENS_PER_STORY');
  const storyDeadlineMs = parseEnvMinToMs('COP1_DEADLINE_MIN_PER_STORY');
  const storyBudgetConfig =
    storyMaxTokens !== undefined || storyDeadlineMs !== undefined
      ? {
          ...(storyMaxTokens !== undefined && { maxTokens: storyMaxTokens }),
          ...(storyDeadlineMs !== undefined && { deadlineMs: storyDeadlineMs }),
        }
      : undefined;

  const svc = new OrchestratorService(
    runner,
    eventBus,
    gate,
    autoDecisionLogger,
    budget,
    worktreePort,
    storyBudgetConfig,
  );

  return { run: () => svc.run({ playbook, epicId: epic, projectRoot, mode }) };
}

function resolveRunner(
  options: { runner?: 'default' | 'stub' },
  projectRoot: string,
  eventBus: EventBus,
  maxUsdPerSessionOverride?: number,
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
  // An explicit override (from the caller's `caps.maxUsdPerSession`) takes
  // precedence over the COP1_MAX_USD_PER_SESSION env var.
  const parsedUsd = Number.parseFloat(process.env.COP1_MAX_USD_PER_SESSION ?? '');
  const envUsd = Number.isFinite(parsedUsd) && parsedUsd > 0 ? parsedUsd : undefined;
  const maxBudgetUsd =
    maxUsdPerSessionOverride !== undefined && maxUsdPerSessionOverride > 0
      ? maxUsdPerSessionOverride
      : envUsd;

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
    // fiche 0016: surface DoD violations to the web mission-control. The run's
    // TaggingEventBus tags emitted payloads with runId downstream.
    eventBus,
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
