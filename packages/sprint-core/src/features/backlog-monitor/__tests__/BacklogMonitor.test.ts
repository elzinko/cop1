import { EventBus } from '@cop1/shared-kernel';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BacklogMonitor } from '../application/BacklogMonitor.js';

describe('BacklogMonitor', () => {
  const eventBus = new EventBus();

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  it('should report sufficient when enough ready stories', () => {
    const backlog = {
      getStories: () => [
        { id: 'S1', title: 'A', status: 'ready', points: 3, acceptanceCriteria: [] },
        { id: 'S2', title: 'B', status: 'ready', points: 5, acceptanceCriteria: [] },
        { id: 'S3', title: 'C', status: 'ready', points: 2, acceptanceCriteria: [] },
      ],
    };

    const monitor = new BacklogMonitor(backlog, eventBus, 3);
    const result = monitor.checkReadiness();

    expect(result.sufficient).toBe(true);
    expect(result.readyCount).toBe(3);
  });

  it('should emit event when insufficient ready stories', () => {
    const handler = vi.fn();
    eventBus.on('backlog.insufficient_coverage', handler);

    const backlog = {
      getStories: () => [
        { id: 'S1', title: 'A', status: 'ready', points: 3, acceptanceCriteria: [] },
      ],
    };

    const monitor = new BacklogMonitor(backlog, eventBus, 5);
    const result = monitor.checkReadiness();

    expect(result.sufficient).toBe(false);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('should count only ready stories', () => {
    const backlog = {
      getStories: () => [
        { id: 'S1', title: 'A', status: 'ready', points: 3, acceptanceCriteria: [] },
        { id: 'S2', title: 'B', status: 'backlog', points: 5, acceptanceCriteria: [] },
        { id: 'S3', title: 'C', status: 'done', points: 2, acceptanceCriteria: [] },
      ],
    };

    const monitor = new BacklogMonitor(backlog, eventBus, 2);
    const result = monitor.checkReadiness();

    expect(result.readyCount).toBe(1);
    expect(result.sufficient).toBe(false);
  });
});
