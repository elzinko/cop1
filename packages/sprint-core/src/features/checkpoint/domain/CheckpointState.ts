export const CheckpointPhase = {
  SLOT_RESERVED: 'agent.slot.reserved',
  STATUS_TRANSITIONING: 'story.status.transitioning',
  TRANSITION: 'transition',
  STATUS_TRANSITIONED: 'story.status.transitioned',
  AGENT_STARTED: 'agent.started',
} as const;

export type CheckpointPhaseValue = (typeof CheckpointPhase)[keyof typeof CheckpointPhase];

export interface CheckpointState {
  storyId: string;
  agentName: string;
  stepIndex: number;
  stepName: string;
  timestamp: string;
  phase: CheckpointPhaseValue;
}
