export const WorkflowEvent = {
  WORKFLOW_STARTED: 'story.workflow.started',
  WORKFLOW_RESUMED: 'story.workflow.resumed',
  STEP_STARTED: 'story.step.started',
  STEP_COMPLETED: 'story.step.completed',
  WORKFLOW_COMPLETED: 'story.workflow.completed',
  WORKFLOW_FAILED: 'story.workflow.failed',
} as const;

export type WorkflowEventValue = (typeof WorkflowEvent)[keyof typeof WorkflowEvent];
