import type { EventBus } from '@cop1/shared-kernel';

interface LLMCallInfo {
  model: string;
  durationMs: number;
  tokenCount: number;
}

export class SprintFormatter {
  private storySteps: Map<string, string[]> = new Map();
  private llmCalls: Map<string, LLMCallInfo> = new Map();

  attach(eventBus: EventBus): void {
    eventBus.on('sprint.starting', (payload: unknown) => {
      const p = payload as {
        totalStories: number;
        eligibleStories: number;
        dryRun: boolean;
        simulate?: boolean;
      };
      console.log(`\nSprint: ${p.eligibleStories} stories eligible (${p.totalStories} total)`);
      if (p.dryRun) {
        console.log('(dry-run mode — no changes will be made)\n');
      } else if (p.simulate) {
        console.log('(simulate mode — isolated worktree, no auto-merge)\n');
      } else {
        console.log('');
      }
    });

    eventBus.on('simulate.worktree.creating', (payload: unknown) => {
      const p = payload as { path: string };
      console.log(`Creating worktree: ${p.path}`);
    });

    eventBus.on('simulate.worktree.created', (payload: unknown) => {
      const p = payload as { path: string };
      console.log(`Worktree ready: ${p.path}\n`);
    });

    eventBus.on('story.workflow.started', (payload: unknown) => {
      const p = payload as { storyId: string; steps: string[] };
      this.storySteps.set(p.storyId, []);
      process.stdout.write(`  [${p.storyId}] `);
    });

    // Buffer LLM call info keyed by agentType (last call wins, sequential execution)
    eventBus.on('llm.call.completed', (payload: unknown) => {
      const p = payload as {
        agentType: string;
        model: string;
        durationMs: number;
        tokenCount: number;
      };
      this.llmCalls.set(p.agentType, {
        model: p.model,
        durationMs: p.durationMs,
        tokenCount: p.tokenCount,
      });
    });

    eventBus.on('story.step.completed', (payload: unknown) => {
      const p = payload as { storyId: string; step: string; status: string };
      const steps = this.storySteps.get(p.storyId) ?? [];
      steps.push(p.step);
      this.storySteps.set(p.storyId, steps);

      const llmInfo = this.llmCalls.get(p.step);
      if (llmInfo) {
        const seconds = (llmInfo.durationMs / 1000).toFixed(1);
        process.stdout.write(`${p.step} (${llmInfo.model} ${seconds}s ${llmInfo.tokenCount}t) ok `);
        this.llmCalls.delete(p.step);
      } else {
        process.stdout.write(`${p.step} ok `);
      }
    });

    eventBus.on('story.workflow.completed', (payload: unknown) => {
      const p = payload as { storyId: string };
      process.stdout.write('-> done\n');
      this.storySteps.delete(p.storyId);
    });

    eventBus.on('story.workflow.failed', (payload: unknown) => {
      const p = payload as { storyId: string; failedStep: string; error?: string };
      process.stdout.write(`-> FAILED at ${p.failedStep}\n`);
      this.storySteps.delete(p.storyId);
    });

    eventBus.on('sprint.completed', (payload: unknown) => {
      const p = payload as {
        storiesDone: number;
        storiesFailed: number;
        storiesSkipped: number;
        durationMs: number;
      };
      const seconds = (p.durationMs / 1000).toFixed(1);
      console.log(`\nSprint completed in ${seconds}s`);
      console.log(
        `  Done: ${p.storiesDone}  Failed: ${p.storiesFailed}  Skipped: ${p.storiesSkipped}`,
      );
    });

    eventBus.on('sprint.expired', (payload: unknown) => {
      const p = payload as { storyId: string };
      console.log(`\n  Session expired before processing ${p.storyId}`);
    });
  }
}
