import { StructuredLogger } from '@cop1/observability';
import { EventBus } from '@cop1/shared-kernel';
import {
  AgentSdkSessionAdapter,
  AgentSdkSupervisorAdapter,
  SessionLogger,
  SupervisorService,
} from '@cop1/sprint-core';
import { PipelineStepFactory } from '../../composition/PipelineStepFactory.js';
import { SprintRunner } from '../../composition/SprintRunner.js';
import { SprintFormatter } from '../formatters/SprintFormatter.js';

export async function sprintRunCommand(options: {
  dryRun?: boolean;
  filter?: string;
  simulate?: boolean;
}): Promise<void> {
  if (options.dryRun && options.simulate) {
    console.error('Error: --dry-run and --simulate are mutually exclusive');
    process.exitCode = 1;
    return;
  }

  const projectPath = process.cwd();
  const eventBus = new EventBus();

  // BMAD multi-turn wiring (ADR-012, EA9-S5): single AgentSdkSessionAdapter +
  // SupervisorService shared by all three BMADSessionStep instances. Both
  // adapters lazy-load the Agent SDK internally — no SDK import needed here.
  const structuredLogger = new StructuredLogger(projectPath);
  const sessionLogger = new SessionLogger(structuredLogger, eventBus);
  const supervisorAdapter = new AgentSdkSupervisorAdapter();
  const supervisorService = new SupervisorService(supervisorAdapter, sessionLogger);
  const questionHandler = supervisorService.createQuestionHandler();

  const sessionPort = new AgentSdkSessionAdapter(eventBus, { questionHandler });

  const stepFactory = new PipelineStepFactory(eventBus, { sessionPort, supervisorService });
  const runner = new SprintRunner({ projectPath, eventBus, stepFactory });
  const formatter = new SprintFormatter();
  formatter.attach(runner.eventBus);

  if (options.dryRun) {
    const eligible = runner.listEligible(options.filter);

    console.log(`\nDry run: ${eligible.length} stories would be processed:\n`);
    for (const s of eligible) {
      console.log(`  ${s.id} [${s.status}] ${s.title}`);
    }
    console.log('');
    return;
  }

  if (options.simulate) {
    console.log('\nWorktree execution mode — running in isolated worktree\n');
  }

  const result = await runner.run({
    filter: options.filter,
    dryRun: false,
    simulate: options.simulate,
  });

  if (result.simulate && result.worktreePath) {
    console.log('\nWorktree preserved for inspection:');
    console.log(`  ${result.worktreePath}`);
    console.log(`\nTo inspect:  cd ${result.worktreePath}`);
    console.log('To merge:    git merge <branch>  (from main)');
    console.log(`To discard:  git worktree remove ${result.worktreePath}`);
  }

  if (result.storiesFailed > 0) {
    process.exitCode = 1;
  }
}
