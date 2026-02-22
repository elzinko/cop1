import type { QualityGatePort } from '@cop1/quality-intelligence';
import type { EventBus } from '@cop1/shared-kernel';
import type { CheckpointState } from '../../checkpoint/domain/CheckpointState.js';
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
    return this.executeFrom(context, steps, 0);
  }

  async resume(
    context: WorkflowContext,
    steps: WorkflowStep[],
    checkpoint: CheckpointState,
  ): Promise<StepResult> {
    const startIndex = checkpoint.stepIndex;

    if (startIndex < 0 || startIndex >= steps.length) {
      return { status: 'failed', error: new Error(`Invalid checkpoint stepIndex: ${startIndex}`) };
    }

    this.eventBus.emit(WorkflowEvent.WORKFLOW_RESUMED, {
      storyId: context.storyId,
      fromStep: checkpoint.stepName,
      fromIndex: startIndex,
    });

    return this.executeFrom(context, steps, startIndex);
  }

  private async executeFrom(
    context: WorkflowContext,
    steps: WorkflowStep[],
    startIndex: number,
  ): Promise<StepResult> {
    if (startIndex === 0) {
      this.eventBus.emit(WorkflowEvent.WORKFLOW_STARTED, {
        storyId: context.storyId,
        steps: steps.map((s) => s.name),
      });
    }

    for (const [i, step] of steps.entries()) {
      if (i < startIndex) continue;

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
        ...(result.report ? { report: result.report } : {}),
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
