import { describe, expect, it } from 'vitest';
import { RunBudget } from '../RunBudget.js';

describe('RunBudget', () => {
  it('does not trip while under all caps', () => {
    const budget = new RunBudget({ maxTokens: 100, deadlineMs: 1000, now: () => 0 });
    budget.recordTokens(50);
    const status = budget.status();
    expect(status.tripped).toBe(false);
    expect(status.reason).toBeUndefined();
    expect(status.spentTokens).toBe(50);
  });

  it('accumulates recorded tokens', () => {
    const budget = new RunBudget({ maxTokens: 100, now: () => 0 });
    budget.recordTokens(30);
    budget.recordTokens(20);
    expect(budget.status().spentTokens).toBe(50);
  });

  it('trips on tokens when spent >= maxTokens', () => {
    const budget = new RunBudget({ maxTokens: 100, now: () => 0 });
    budget.recordTokens(60);
    expect(budget.status().tripped).toBe(false);
    budget.recordTokens(40);
    const status = budget.status();
    expect(status.tripped).toBe(true);
    expect(status.reason).toBe('tokens');
  });

  it('trips on wallclock when elapsed >= deadlineMs', () => {
    let clock = 0;
    const budget = new RunBudget({ deadlineMs: 500, now: () => clock });
    expect(budget.status().tripped).toBe(false);
    clock = 500;
    const status = budget.status();
    expect(status.tripped).toBe(true);
    expect(status.reason).toBe('wallclock');
    expect(status.elapsedMs).toBe(500);
  });

  it('trips on abort-file when externalAbort returns true', () => {
    let aborting = false;
    const budget = new RunBudget({ now: () => 0, externalAbort: () => aborting });
    expect(budget.status().tripped).toBe(false);
    aborting = true;
    const status = budget.status();
    expect(status.tripped).toBe(true);
    expect(status.reason).toBe('abort-file');
  });

  it('prioritizes tokens over wallclock over abort-file', () => {
    const clock = { ms: 1000 };
    const budget = new RunBudget({
      maxTokens: 10,
      deadlineMs: 500,
      now: () => clock.ms,
      externalAbort: () => true,
    });
    budget.recordTokens(10); // tokens tripped
    expect(budget.status().reason).toBe('tokens');

    // Without tokens, wallclock wins over abort-file.
    const wallclock = { ms: 0 };
    const wallclockBudget = new RunBudget({
      deadlineMs: 500,
      now: () => wallclock.ms,
      externalAbort: () => true,
    });
    wallclock.ms = 1000;
    expect(wallclockBudget.status().reason).toBe('wallclock');
  });
});
