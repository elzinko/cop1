import type { SprintMetrics, StoryCard } from '../domain/SprintDashboardTypes.js';

export class SprintDashboardService {
  computeMetrics(stories: StoryCard[]): SprintMetrics {
    const totalStories = stories.length;
    const completedStories = stories.filter((s) => s.status === 'done').length;
    const inProgressStories = stories.filter((s) => s.status === 'in-progress').length;
    const blockedStories = stories.filter((s) => s.status === 'blocked').length;

    const totalPoints = stories.reduce((sum, s) => sum + s.points, 0);
    const completedPoints = stories
      .filter((s) => s.status === 'done')
      .reduce((sum, s) => sum + s.points, 0);

    const completionPercentage =
      totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

    return {
      totalStories,
      completedStories,
      inProgressStories,
      blockedStories,
      totalPoints,
      completedPoints,
      completionPercentage,
    };
  }

  groupByStatus(stories: StoryCard[]): Record<string, StoryCard[]> {
    const groups: Record<string, StoryCard[]> = {};
    for (const story of stories) {
      if (!groups[story.status]) {
        groups[story.status] = [];
      }
      groups[story.status]?.push(story);
    }
    return groups;
  }

  filterByAgent(stories: StoryCard[], agentName: string): StoryCard[] {
    return stories.filter((s) => s.assignedAgent === agentName);
  }

  sortByPoints(stories: StoryCard[], descending = true): StoryCard[] {
    return [...stories].sort((a, b) => (descending ? b.points - a.points : a.points - b.points));
  }
}
