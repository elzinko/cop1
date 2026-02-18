import type { StepResult } from './StepResult.js';
import type { WorkflowContext } from './WorkflowContext.js';

export interface WorkflowStep {
  name: string;
  run(context: WorkflowContext): Promise<StepResult>;
}
