import type { QualityGatePort } from '@cop1/quality-intelligence';
import type { EventBus } from '@cop1/shared-kernel';
import type { StepResult } from '../domain/StepResult.js';
import type { WorkflowContext } from '../domain/WorkflowContext.js';
import { WorkflowEvent } from '../domain/WorkflowEvent.js';
import type { WorkflowStep } from '../domain/WorkflowStep.js';

export class WorkflowEngine {
  constructor(
    private readonly eventBus: EventBus,
    private readonly qualityGate: QualityGatePort,
  ) {}

  async run(context: WorkflowContext, steps: WorkflowStep[]): Promise<StepResult> {
    this.eventBus.emit(WorkflowEvent.WORKFLOW_STARTED, {
      storyId: context.storyId,
      steps: steps.map((s) => s.name),
    });

    for (const [i, step] of steps.entries()) {
      this.eventBus.emit(WorkflowEvent.STEP_STARTED, {
        storyId: context.storyId,
        step: step.name,
        index: i,
      });

      const result = await step.run(context);

      if (result.status === 'failed') {
        this.eventBus.emit(WorkflowEvent.WORKFLOW_FAILED, {
          storyId: context.storyId,
          failedStep: step.name,
          error: result.error?.message,
        });
        return result;
      }

      this.eventBus.emit(WorkflowEvent.STEP_COMPLETED, {
        storyId: context.storyId,
        step: step.name,
        index: i,
        status: result.status,
      });

      // Run quality gate between steps (not after the last one)
      if (i < steps.length - 1) {
        await this.qualityGate.runAll({
          storyId: context.storyId,
          projectPath: context.projectPath,
        });
      }
    }

    this.eventBus.emit(WorkflowEvent.WORKFLOW_COMPLETED, {
      storyId: context.storyId,
    });

    return { status: 'ok' };
  }
}
