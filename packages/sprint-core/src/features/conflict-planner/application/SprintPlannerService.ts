export interface PlanStory {
  id: string;
  title: string;
  featurePath: string;
  points: number;
}

export interface SessionPlan {
  sessionIndex: number;
  stories: PlanStory[];
}

export class SprintPlannerService {
  planNocturnal(stories: PlanStory[]): SessionPlan[] {
    const featureGroups = new Map<string, PlanStory[]>();

    for (const story of stories) {
      const existing = featureGroups.get(story.featurePath) ?? [];
      existing.push(story);
      featureGroups.set(story.featurePath, existing);
    }

    const sessions: SessionPlan[] = [];
    const assigned = new Set<string>();

    let sessionIndex = 0;
    while (assigned.size < stories.length) {
      const sessionStories: PlanStory[] = [];
      const usedFeatures = new Set<string>();

      for (const story of stories) {
        if (assigned.has(story.id)) continue;
        if (usedFeatures.has(story.featurePath)) continue;

        sessionStories.push(story);
        usedFeatures.add(story.featurePath);
        assigned.add(story.id);
      }

      if (sessionStories.length === 0) break;

      sessions.push({ sessionIndex, stories: sessionStories });
      sessionIndex++;
    }

    return sessions;
  }
}
