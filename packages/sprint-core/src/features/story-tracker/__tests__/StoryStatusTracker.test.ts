import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StoryStatusTracker } from '../application/StoryStatusTracker.js';
import { InvalidTransitionError } from '../domain/errors/InvalidTransitionError.js';
import { YamlStatusStore } from '../infrastructure/YamlStatusStore.js';

describe('StoryStatusTracker', () => {
  let testDir: string;
  let tracker: StoryStatusTracker;

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `cop1-tracker-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(testDir, { recursive: true });
    const store = new YamlStatusStore(testDir);
    tracker = new StoryStatusTracker(store);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should set valid status transitions', () => {
    tracker.setStatus('E1-S1', 'ready');
    expect(tracker.getStatus('E1-S1')?.status).toBe('ready');

    tracker.setStatus('E1-S1', 'in-progress');
    expect(tracker.getStatus('E1-S1')?.status).toBe('in-progress');

    tracker.setStatus('E1-S1', 'review');
    tracker.setStatus('E1-S1', 'done');
    expect(tracker.getStatus('E1-S1')?.status).toBe('done');
  });

  it('should throw InvalidTransitionError for invalid transitions', () => {
    tracker.setStatus('E1-S1', 'ready');
    tracker.setStatus('E1-S1', 'in-progress');
    tracker.setStatus('E1-S1', 'review');
    tracker.setStatus('E1-S1', 'done');

    expect(() => tracker.setStatus('E1-S1', 'in-progress')).toThrow(InvalidTransitionError);
  });

  it('should allow rework transition from review to in-progress', () => {
    tracker.setStatus('E1-S1', 'ready');
    tracker.setStatus('E1-S1', 'in-progress');
    tracker.setStatus('E1-S1', 'review');
    tracker.setStatus('E1-S1', 'in-progress'); // rework

    expect(tracker.getStatus('E1-S1')?.status).toBe('in-progress');
  });

  it('should return all statuses', () => {
    tracker.setStatus('E1-S1', 'ready');
    tracker.setStatus('E1-S2', 'ready');

    const all = tracker.getAllStatuses();
    expect(all.size).toBe(2);
  });

  it('should return null for unknown story', () => {
    expect(tracker.getStatus('unknown')).toBeNull();
  });

  it('should persist across instances', () => {
    tracker.setStatus('E1-S1', 'ready');

    const store2 = new YamlStatusStore(testDir);
    const tracker2 = new StoryStatusTracker(store2);
    expect(tracker2.getStatus('E1-S1')?.status).toBe('ready');
  });
});
