import { beforeEach, describe, expect, it } from 'vitest';
import { AgentSelfAssessmentService } from '../application/AgentSelfAssessmentService.js';

describe('AgentSelfAssessmentService', () => {
  let service: AgentSelfAssessmentService;

  beforeEach(() => {
    service = new AgentSelfAssessmentService();
  });

  it('should assess good performance with no proposed changes', () => {
    const proposal = service.assess({
      agentName: 'dev-agent',
      storiesCompleted: 8,
      storiesAssigned: 10,
      avgIterations: 2,
      blocagesRaised: 1,
    });

    expect(proposal.agentName).toBe('dev-agent');
    expect(proposal.type).toBe('agent-behavior');
    expect(proposal.proposedChanges).toHaveLength(0);
    expect(proposal.assessment).toContain('performing within acceptable parameters');
    expect(proposal.status).toBe('pending_review');
  });

  it('should propose reducing iterations when avg iterations is high', () => {
    const proposal = service.assess({
      agentName: 'dev-agent',
      storiesCompleted: 8,
      storiesAssigned: 10,
      avgIterations: 5,
      blocagesRaised: 2,
    });

    expect(proposal.proposedChanges).toContain('Reduce iteration count');
    expect(proposal.assessment).toContain('exceeds threshold');
  });

  it('should propose improving completion when rate is low', () => {
    const proposal = service.assess({
      agentName: 'dev-agent',
      storiesCompleted: 3,
      storiesAssigned: 10,
      avgIterations: 2,
      blocagesRaised: 0,
    });

    expect(proposal.proposedChanges).toContain('Improve story completion');
    expect(proposal.assessment).toContain('below 70% target');
  });

  it('should propose multiple changes when multiple issues exist', () => {
    const proposal = service.assess({
      agentName: 'dev-agent',
      storiesCompleted: 2,
      storiesAssigned: 10,
      avgIterations: 5,
      blocagesRaised: 3,
    });

    expect(proposal.proposedChanges).toHaveLength(2);
    expect(proposal.proposedChanges).toContain('Reduce iteration count');
    expect(proposal.proposedChanges).toContain('Improve story completion');
  });
});
