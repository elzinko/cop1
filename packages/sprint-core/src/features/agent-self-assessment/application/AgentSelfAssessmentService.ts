import type {
  AgentBehaviorProposal,
  AgentPerformanceData,
} from '../domain/AgentAssessmentTypes.js';

export class AgentSelfAssessmentService {
  assess(data: AgentPerformanceData): AgentBehaviorProposal {
    const completionRate =
      data.storiesAssigned > 0 ? data.storiesCompleted / data.storiesAssigned : 1;

    const assessmentParts: string[] = [];
    const proposedChanges: string[] = [];

    if (data.avgIterations > 3) {
      assessmentParts.push(`Average iterations (${data.avgIterations}) exceeds threshold of 3.`);
      proposedChanges.push('Reduce iteration count');
    }

    if (completionRate < 0.7) {
      assessmentParts.push(
        `Completion rate (${(completionRate * 100).toFixed(0)}%) is below 70% target.`,
      );
      proposedChanges.push('Improve story completion');
    }

    if (assessmentParts.length === 0) {
      assessmentParts.push(`Agent ${data.agentName} is performing within acceptable parameters.`);
    }

    return {
      agentName: data.agentName,
      type: 'agent-behavior',
      assessment: assessmentParts.join(' '),
      proposedChanges,
      status: 'pending_review',
    };
  }
}
