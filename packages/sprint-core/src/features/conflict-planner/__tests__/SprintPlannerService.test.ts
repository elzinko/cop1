import { describe, expect, it } from 'vitest';
import type { PlanStory } from '../application/SprintPlannerService.js';
import { SprintPlannerService } from '../application/SprintPlannerService.js';

describe('SprintPlannerService', () => {
  const planner = new SprintPlannerService();

  it('should separate conflicting stories into different sessions', () => {
    const stories: PlanStory[] = [
      { id: 'S1', title: 'Feature A part 1', featurePath: 'src/auth', points: 5 },
      { id: 'S2', title: 'Feature A part 2', featurePath: 'src/auth', points: 3 },
      { id: 'S3', title: 'Feature B', featurePath: 'src/api', points: 5 },
    ];

    const sessions = planner.planNocturnal(stories);

    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.stories).toHaveLength(2); // S1 (auth) + S3 (api)
    expect(sessions[1]?.stories).toHaveLength(1); // S2 (auth)
  });

  it('should put non-conflicting stories in same session', () => {
    const stories: PlanStory[] = [
      { id: 'S1', title: 'A', featurePath: 'src/auth', points: 5 },
      { id: 'S2', title: 'B', featurePath: 'src/api', points: 3 },
      { id: 'S3', title: 'C', featurePath: 'src/ui', points: 2 },
    ];

    const sessions = planner.planNocturnal(stories);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.stories).toHaveLength(3);
  });

  it('should handle empty story list', () => {
    const sessions = planner.planNocturnal([]);
    expect(sessions).toHaveLength(0);
  });

  it('should assign session indices', () => {
    const stories: PlanStory[] = [
      { id: 'S1', title: 'A', featurePath: 'src/x', points: 5 },
      { id: 'S2', title: 'B', featurePath: 'src/x', points: 3 },
    ];

    const sessions = planner.planNocturnal(stories);
    expect(sessions[0]?.sessionIndex).toBe(0);
    expect(sessions[1]?.sessionIndex).toBe(1);
  });
});
