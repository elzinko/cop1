export interface AgentBehaviorProposal {
  agentName: string;
  type: 'agent-behavior';
  assessment: string;
  proposedChanges: string[];
  status: 'pending_review';
}

export interface AgentPerformanceData {
  agentName: string;
  storiesCompleted: number;
  storiesAssigned: number;
  avgIterations: number;
  blocagesRaised: number;
}
