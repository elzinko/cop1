import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { EventBus } from '@cop1/shared-kernel';
import {
  type BMADCommandRunner,
  type OrchestratorMode,
  OrchestratorService,
} from '../../features/orchestrator/application/OrchestratorService.js';
import { SupervisorPlaybookLoader } from '../../features/orchestrator/application/SupervisorPlaybookLoader.js';
import { createInterCommandApprovalResolver } from '../../features/orchestrator/infrastructure/InterCommandApprovalResolver.js';

export interface OrchestratorRunCliOptions {
  playbook?: string;
  epic: string;
  stepByStep?: boolean;
  abortOnEscalation?: boolean;
  projectRoot?: string;
}

/**
 * Default `BMADCommandRunner` — no-op stub that returns a success transition.
 * Real wiring to `SprintRunner` / `BMADSessionPort` happens in a follow-up
 * integration story; the CLI accepts a custom runner via DI for tests.
 */
const stubRunner: BMADCommandRunner = async ({ command }) => {
  const nextStatus = command.includes('create-story')
    ? 'ready-for-dev'
    : command.includes('dev-story')
      ? 'in-review'
      : 'done';
  return { success: true, nextStatus };
};

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

  // Auto-decision JSONL sink
  const logDir = join(projectRoot, '.cop1');
  await mkdir(logDir, { recursive: true });
  const logPath = join(logDir, `sprint-log-${new Date().toISOString().slice(0, 10)}.jsonl`);
  const autoDecisionLogger = (payload: Record<string, unknown>) => {
    void appendFile(logPath, `${JSON.stringify(payload)}\n`, 'utf-8');
  };

  const svc = new OrchestratorService(
    overrides.runner ?? stubRunner,
    eventBus,
    gate,
    autoDecisionLogger,
  );

  try {
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
