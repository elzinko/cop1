import type { StepResult } from '../../workflow/domain/StepResult.js';
import type { WorkflowContext } from '../../workflow/domain/WorkflowContext.js';
import type { WorkflowStep } from '../../workflow/domain/WorkflowStep.js';
import { StoryContextBuilder } from '../domain/StoryContextBuilder.js';
import type { BMADCommandPort } from '../domain/ports/BMADCommandPort.js';

export abstract class BMADCommandStep implements WorkflowStep {
  abstract readonly name: string;
  protected abstract readonly command: string;
  protected abstract readonly errorPrefix: string;

  private readonly contextBuilder = new StoryContextBuilder();

  constructor(protected readonly commandPort: BMADCommandPort) {}

  async run(context: WorkflowContext): Promise<StepResult> {
    try {
      const storyContent = context.storyContent ?? `Story: ${context.storyId}`;

      const bmadContext = this.contextBuilder.build({
        storyId: context.storyId,
        storyContent,
        projectPath: context.projectPath,
      });

      const result = await this.commandPort.execute(this.command, bmadContext);

      if (!result.success) {
        return {
          status: 'failed',
          error: new Error(`${this.errorPrefix}: ${result.output.slice(0, 500)}`),
        };
      }

      return {
        status: 'ok',
        report: result.output,
      };
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}
