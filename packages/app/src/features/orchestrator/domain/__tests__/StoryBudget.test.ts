import { describe, expect, it } from 'vitest';
import type { BudgetGuard, BudgetStatus } from '../RunBudget.js';
import { StoryBudget } from '../StoryBudget.js';

/**
 * A fake run BudgetGuard whose `status()` the test controls directly. Only the
 * monotonic counters `spentTokens` / `elapsedMs` matter to StoryBudget — the
 * run-level `tripped`/`reason` are irrelevant to the per-story view.
 */
function fakeGuard(initial: { spentTokens: number; elapsedMs: number }): BudgetGuard & {
  set(next: { spentTokens: number; elapsedMs: number }): void;
} {
  let current: BudgetStatus = { tripped: false, ...initial };
  return {
    recordTokens: () => {},
    status: () => current,
    set: (next) => {
      current = { tripped: false, ...next };
    },
  };
}

describe('StoryBudget', () => {
  it('snapshots the run counters at construction and diffs from them', () => {
    const guard = fakeGuard({ spentTokens: 1000, elapsedMs: 5000 });
    const story = new StoryBudget(guard, { maxTokens: 500, deadlineMs: 10_000 });

    guard.set({ spentTokens: 1200, elapsedMs: 5300 });
    const status = story.status();

    expect(status.storyTokens).toBe(200);
    expect(status.storyElapsedMs).toBe(300);
    expect(status.tripped).toBe(false);
    expect(status.reason).toBeUndefined();
  });

  it('trips story-tokens when (spent - start) >= maxTokens', () => {
    const guard = fakeGuard({ spentTokens: 100, elapsedMs: 0 });
    const story = new StoryBudget(guard, { maxTokens: 50 });

    guard.set({ spentTokens: 149, elapsedMs: 0 });
    expect(story.status().tripped).toBe(false);

    guard.set({ spentTokens: 150, elapsedMs: 0 });
    const status = story.status();
    expect(status.tripped).toBe(true);
    expect(status.reason).toBe('story-tokens');
    expect(status.storyTokens).toBe(50);
  });

  it('trips story-wallclock when (elapsed - start) >= deadlineMs', () => {
    const guard = fakeGuard({ spentTokens: 0, elapsedMs: 2000 });
    const story = new StoryBudget(guard, { deadlineMs: 500 });

    guard.set({ spentTokens: 0, elapsedMs: 2499 });
    expect(story.status().tripped).toBe(false);

    guard.set({ spentTokens: 0, elapsedMs: 2500 });
    const status = story.status();
    expect(status.tripped).toBe(true);
    expect(status.reason).toBe('story-wallclock');
    expect(status.storyElapsedMs).toBe(500);
  });

  it('does not trip while below both caps', () => {
    const guard = fakeGuard({ spentTokens: 10, elapsedMs: 10 });
    const story = new StoryBudget(guard, { maxTokens: 100, deadlineMs: 1000 });

    guard.set({ spentTokens: 60, elapsedMs: 510 });
    const status = story.status();
    expect(status.tripped).toBe(false);
    expect(status.storyTokens).toBe(50);
    expect(status.storyElapsedMs).toBe(500);
  });

  it('prioritizes story-tokens over story-wallclock', () => {
    const guard = fakeGuard({ spentTokens: 0, elapsedMs: 0 });
    const story = new StoryBudget(guard, { maxTokens: 10, deadlineMs: 10 });

    guard.set({ spentTokens: 20, elapsedMs: 100 });
    expect(story.status().reason).toBe('story-tokens');
  });

  it('never trips when no cap is configured', () => {
    const guard = fakeGuard({ spentTokens: 0, elapsedMs: 0 });
    const story = new StoryBudget(guard, {});

    guard.set({ spentTokens: 1_000_000, elapsedMs: 1_000_000 });
    const status = story.status();
    expect(status.tripped).toBe(false);
    expect(status.reason).toBeUndefined();
    expect(status.storyTokens).toBe(1_000_000);
    expect(status.storyElapsedMs).toBe(1_000_000);
  });
});
