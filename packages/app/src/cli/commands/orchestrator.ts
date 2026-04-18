import { existsSync } from 'node:fs';
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { EventBus } from '@cop1/shared-kernel';
import {
  AgentSdkSessionAdapter,
  AgentSdkSupervisorAdapter,
  type BMADSessionPort,
  ClaudeResumeSessionAdapter,
  ExchangeHistoryWriter,
  SessionInteractionCollector,
  SupervisorService,
} from '@cop1/sprint-core';
import { StructuredLogger } from '@cop1/observability';
import {
  type BMADCommandRunner,
  type OrchestratorMode,
  OrchestratorService,
} from '../../features/orchestrator/application/OrchestratorService.js';
import { SupervisorPlaybookLoader } from '../../features/orchestrator/application/SupervisorPlaybookLoader.js';
import { createDefaultBMADCommandRunner } from '../../features/orchestrator/infrastructure/DefaultBMADCommandRunner.js';
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
  let playbook;
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

  try {
    const runner = overrides.runner ?? resolveRunner(options, projectRoot, eventBus);
    const svc = new OrchestratorService(runner, eventBus, gate, autoDecisionLogger);
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
      `No BMAD installation found at ${bmadDir}. ` +
        'The orchestrator requires BMAD workflows to execute real sprint commands. ' +
        'Install BMAD or use --runner stub (with COP1_ALLOW_STUB_RUNNER=1) for testing.',
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

  const adapterChoice = (process.env.COP1_BMAD_ADAPTER ?? '').trim();
  let sessionPort: BMADSessionPort;
  if (adapterChoice === 'resume') {
    console.log('BMAD adapter: claude --resume fallback (COP1_BMAD_ADAPTER=resume)');
    sessionPort = new ClaudeResumeSessionAdapter(eventBus, { questionHandler });
  } else {
    if (adapterChoice && adapterChoice !== 'sdk') {
      console.warn(
        `Unknown COP1_BMAD_ADAPTER value '${adapterChoice}', falling back to 'sdk'`,
      );
    }
    sessionPort = new AgentSdkSessionAdapter(eventBus, { questionHandler });
  }

  // EA14-S2: Wire ExchangeHistoryWriter for Track 2 per-session markdown files.
  const exchangeHistoryWriter = new ExchangeHistoryWriter(projectRoot);

  return createDefaultBMADCommandRunner({
    sessionPort,
    supervisorService,
    exchangeHistoryWriter,
    interactionCollector,
  });
}
