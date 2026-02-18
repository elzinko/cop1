import type { PlanningDecision } from '../domain/PlanningDecision.js';

export interface ReadyStory {
  id: string;
  title: string;
  points: number;
}

export class SprintPlanningCeremony {
  selectStories(readyStories: ReadyStory[], capacity: number): PlanningDecision {
    const engaged: ReadyStory[] = [];
    let totalPoints = 0;

    // Select stories in order until capacity is reached
    for (const story of readyStories) {
      if (totalPoints + story.points <= capacity) {
        engaged.push(story);
        totalPoints += story.points;
      }
    }

    return {
      sprintId: `sprint-${Date.now()}`,
      engagedStories: engaged.map((s) => ({ id: s.id, title: s.title, points: s.points })),
      totalPoints,
      capacity,
      decidedAt: new Date().toISOString(),
    };
  }
}
