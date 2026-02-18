import { describe, expect, it } from 'vitest';
import { SprintPlanningCeremony } from '../application/SprintPlanningCeremony.js';

describe('SprintPlanningCeremony', () => {
  it('should select stories within capacity', () => {
    const ceremony = new SprintPlanningCeremony();
    const stories = [
      { id: 'E1-S1', title: 'Story 1', points: 5 },
      { id: 'E1-S2', title: 'Story 2', points: 3 },
      { id: 'E1-S3', title: 'Story 3', points: 8 },
    ];

    const decision = ceremony.selectStories(stories, 10);

    expect(decision.engagedStories).toHaveLength(2);
    expect(decision.totalPoints).toBe(8);
    expect(decision.capacity).toBe(10);
  });

  it('should not exceed capacity', () => {
    const ceremony = new SprintPlanningCeremony();
    const stories = [
      { id: 'E1-S1', title: 'Big story', points: 13 },
      { id: 'E1-S2', title: 'Small story', points: 2 },
    ];

    const decision = ceremony.selectStories(stories, 10);

    expect(decision.engagedStories).toHaveLength(1);
    expect(decision.totalPoints).toBe(2);
  });

  it('should handle empty story list', () => {
    const ceremony = new SprintPlanningCeremony();
    const decision = ceremony.selectStories([], 20);

    expect(decision.engagedStories).toHaveLength(0);
    expect(decision.totalPoints).toBe(0);
  });

  it('should handle zero capacity', () => {
    const ceremony = new SprintPlanningCeremony();
    const stories = [{ id: 'E1-S1', title: 'Story', points: 3 }];

    const decision = ceremony.selectStories(stories, 0);

    expect(decision.engagedStories).toHaveLength(0);
  });
});
