import { describe, expect, it } from 'vitest';
import { RoundTableEngine } from '../../round-table/application/RoundTableEngine.js';
import type { RoundTableParticipant } from '../../round-table/domain/RoundTableTypes.js';
import { SprintReviewCeremony } from '../application/SprintReviewCeremony.js';
import type { ReviewParticipantPort, SprintReviewInput } from '../domain/SprintReviewTypes.js';

function makeParticipant(name: string, position: string): RoundTableParticipant {
  return {
    name,
    contribute: async () => position,
  };
}

function makePort(participants: RoundTableParticipant[]): ReviewParticipantPort {
  return { getParticipants: () => participants };
}

const defaultInput: SprintReviewInput = {
  sprintId: 'sprint-1',
  deliveredStories: [
    { id: 'S1', title: 'Story 1', points: 5 },
    { id: 'S2', title: 'Story 2', points: 3 },
  ],
  qualityMetrics: { coveragePercent: 85, gatesPassed: true, blocagesCount: 0 },
};

describe('SprintReviewCeremony', () => {
  it('should run a review and return a result', async () => {
    const engine = new RoundTableEngine();
    const port = makePort([
      makeParticipant('PM', 'good delivery velocity'),
      makeParticipant('Architect', 'good delivery velocity'),
      makeParticipant('ScrumMaster', 'good delivery velocity'),
    ]);

    const ceremony = new SprintReviewCeremony(engine, port);
    const result = await ceremony.run(defaultInput);

    expect(result).toBeDefined();
    expect(result.summary).toBeTruthy();
    expect(result.nextSprintFocus).toBeTruthy();
  });

  it('should generate a summary from round table synthesis', async () => {
    const engine = new RoundTableEngine();
    const port = makePort([
      makeParticipant('PM', 'great progress this sprint'),
      makeParticipant('Architect', 'great progress this sprint'),
    ]);

    const ceremony = new SprintReviewCeremony(engine, port);
    const result = await ceremony.run(defaultInput);

    expect(result.summary).toContain('great progress this sprint');
  });

  it('should include recommendations from contributions', async () => {
    const engine = new RoundTableEngine();
    const port = makePort([
      makeParticipant('PM', 'increase test coverage'),
      makeParticipant('Architect', 'increase test coverage'),
      makeParticipant('ScrumMaster', 'increase test coverage'),
    ]);

    const ceremony = new SprintReviewCeremony(engine, port);
    const result = await ceremony.run(defaultInput);

    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations[0]).toContain('increase test coverage');
  });

  it('should handle empty sprint with no delivered stories', async () => {
    const engine = new RoundTableEngine();
    const port = makePort([makeParticipant('PM', 'no work done')]);

    const ceremony = new SprintReviewCeremony(engine, port);
    const result = await ceremony.run({
      sprintId: 'sprint-empty',
      deliveredStories: [],
      qualityMetrics: { coveragePercent: 0, gatesPassed: false, blocagesCount: 0 },
    });

    expect(result.summary).toContain('no stories delivered');
    expect(result.recommendations).toHaveLength(0);
  });
});
