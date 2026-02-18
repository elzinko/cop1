import { describe, expect, it } from 'vitest';
import { PMAgent } from '../application/PMAgent.js';
import type { BacklogPort, BacklogStory } from '../domain/ports/BacklogPort.js';

function createBacklog(stories: BacklogStory[]): BacklogPort {
  return { getStories: () => stories };
}

const sampleStories: BacklogStory[] = [
  { id: 'S1', title: 'Setup monorepo', status: 'done', points: 5, acceptanceCriteria: ['AC1'] },
  {
    id: 'S2',
    title: 'Implement auth',
    status: 'done',
    points: 8,
    acceptanceCriteria: ['AC1', 'AC2'],
  },
  { id: 'S3', title: 'Add tests', status: 'ready', points: 3, acceptanceCriteria: ['AC1'] },
  { id: 'S4', title: 'Fix bug', status: 'backlog', points: null, acceptanceCriteria: [] },
  {
    id: 'S5',
    title: 'Refactor module',
    status: 'in-progress',
    points: 5,
    acceptanceCriteria: ['AC1', 'AC2'],
  },
];

describe('PMAgent', () => {
  it('should generate a backlog health report', () => {
    const agent = new PMAgent(createBacklog(sampleStories));
    const report = agent.backlogHealthReport();

    expect(report).toContain('# Backlog Health Report');
    expect(report).toContain('Total stories: 5');
    expect(report).toContain('Ready for sprint: 1');
    expect(report).toContain('In grooming: 1');
  });

  it('should warn when insufficient ready stories', () => {
    const agent = new PMAgent(createBacklog(sampleStories), 2);
    const report = agent.backlogHealthReport();

    expect(report).toContain('Warning');
  });

  it('should estimate effort using Fibonacci', () => {
    const agent = new PMAgent(createBacklog([]));
    const story: BacklogStory = {
      id: 'S1',
      title: 'Add user authentication with OAuth',
      status: 'backlog',
      points: null,
      acceptanceCriteria: ['Login works', 'Logout works', 'Token refresh'],
    };

    const result = agent.estimateEffort(story);
    expect([1, 2, 3, 5, 8, 13]).toContain(result.estimate);
    expect(result.justification).toContain('acceptance criteria');
  });

  it('should return Fibonacci 1 for minimal story', () => {
    const agent = new PMAgent(createBacklog([]));
    const story: BacklogStory = {
      id: 'S1',
      title: 'Fix typo',
      status: 'backlog',
      points: null,
      acceptanceCriteria: [],
    };

    const result = agent.estimateEffort(story);
    expect(result.estimate).toBe(1);
  });
});
