import { describe, expect, it } from 'vitest';
import type { ImprovementProposal } from '../../retrospective/domain/RetroTypes.js';
import { RoundTableEngine } from '../../round-table/application/RoundTableEngine.js';
import type { RoundTableParticipant } from '../../round-table/domain/RoundTableTypes.js';
import { ImprovementReviewSession } from '../application/ImprovementReviewSession.js';
import type { ImprovementReviewParticipantPort } from '../domain/ImprovementReviewTypes.js';

function makeParticipant(name: string, position: string): RoundTableParticipant {
  return {
    name,
    contribute: async () => position,
  };
}

function makePort(participants: RoundTableParticipant[]): ImprovementReviewParticipantPort {
  return { getParticipants: () => participants };
}

const archRuleSuggestion: ImprovementProposal = {
  type: 'architecture-rule',
  rule: 'Use repository pattern for data access',
  reason: 'Improve testability',
  status: 'pending_review',
};

describe('ImprovementReviewSession', () => {
  it('should approve when consensus is reached', async () => {
    const engine = new RoundTableEngine();
    const port = makePort([
      makeParticipant('SM', 'agree this rule should be adopted'),
      makeParticipant('PM', 'agree this rule should be adopted'),
      makeParticipant('Architect', 'agree this rule should be adopted'),
    ]);

    const session = new ImprovementReviewSession(engine, port);
    const result = await session.review({
      suggestion: archRuleSuggestion,
      context: 'Sprint 4 retrospective identified data access issues',
    });

    expect(result.verdict).toBe('approved');
    expect(result.reasoning).toBeTruthy();
  });

  it('should reject without consensus', async () => {
    const engine = new RoundTableEngine();
    const port = makePort([
      makeParticipant('SM', 'this proposal is absolutely terrible reject immediately'),
      makeParticipant('PM', 'wonderful idea we should adopt this great rule now'),
      makeParticipant('Architect', 'completely unnecessary change avoid at all costs'),
    ]);

    const session = new ImprovementReviewSession(engine, port);
    const result = await session.review({
      suggestion: archRuleSuggestion,
      context: 'Debatable improvement',
    });

    expect(result.verdict).toBe('rejected');
  });

  it('should return needs-more-info when a participant signals it', async () => {
    const engine = new RoundTableEngine();
    const port = makePort([
      makeParticipant('SM', 'needs-more-info before we can decide'),
      makeParticipant('PM', 'needs-more-info before we can decide'),
      makeParticipant('Architect', 'needs-more-info before we can decide'),
    ]);

    const session = new ImprovementReviewSession(engine, port);
    const result = await session.review({
      suggestion: archRuleSuggestion,
      context: 'Unclear context',
    });

    expect(result.verdict).toBe('needs-more-info');
  });

  it('should return contributions from all participants', async () => {
    const engine = new RoundTableEngine();
    const port = makePort([
      makeParticipant('SM', 'agree with this proposal fully'),
      makeParticipant('PM', 'agree with this proposal fully'),
    ]);

    const session = new ImprovementReviewSession(engine, port);
    const result = await session.review({
      suggestion: archRuleSuggestion,
      context: 'Review session',
    });

    expect(result.contributions.length).toBeGreaterThanOrEqual(2);
    expect(result.contributions.some((c) => c.agent === 'SM')).toBe(true);
    expect(result.contributions.some((c) => c.agent === 'PM')).toBe(true);
  });
});
