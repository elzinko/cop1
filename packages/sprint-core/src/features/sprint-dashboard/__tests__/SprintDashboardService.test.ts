import { describe, expect, it } from 'vitest';
import { SprintDashboardService } from '../application/SprintDashboardService.js';
import type { StoryCard } from '../domain/SprintDashboardTypes.js';

const stories: StoryCard[] = [
  { id: 'S1', title: 'Story 1', status: 'done', points: 5, assignedAgent: 'dev-agent' },
  { id: 'S2', title: 'Story 2', status: 'done', points: 3, assignedAgent: 'dev-agent' },
  { id: 'S3', title: 'Story 3', status: 'in-progress', points: 8, assignedAgent: 'qa-agent' },
  { id: 'S4', title: 'Story 4', status: 'blocked', points: 5 },
  { id: 'S5', title: 'Story 5', status: 'backlog', points: 2 },
];

describe('SprintDashboardService', () => {
  const service = new SprintDashboardService();

  it('should compute sprint metrics', () => {
    const metrics = service.computeMetrics(stories);

    expect(metrics.totalStories).toBe(5);
    expect(metrics.completedStories).toBe(2);
    expect(metrics.inProgressStories).toBe(1);
    expect(metrics.blockedStories).toBe(1);
    expect(metrics.totalPoints).toBe(23);
    expect(metrics.completedPoints).toBe(8);
    expect(metrics.completionPercentage).toBe(35);
  });

  it('should return 0% completion for empty sprint', () => {
    const metrics = service.computeMetrics([]);
    expect(metrics.completionPercentage).toBe(0);
    expect(metrics.totalStories).toBe(0);
  });

  it('should group stories by status', () => {
    const groups = service.groupByStatus(stories);

    expect(groups.done).toHaveLength(2);
    expect(groups['in-progress']).toHaveLength(1);
    expect(groups.blocked).toHaveLength(1);
    expect(groups.backlog).toHaveLength(1);
  });

  it('should filter stories by agent', () => {
    const filtered = service.filterByAgent(stories, 'dev-agent');
    expect(filtered).toHaveLength(2);
    expect(filtered.every((s) => s.assignedAgent === 'dev-agent')).toBe(true);
  });

  it('should sort stories by points descending', () => {
    const sorted = service.sortByPoints(stories);
    expect(sorted[0]?.points).toBe(8);
    expect(sorted[sorted.length - 1]?.points).toBe(2);
  });
});
