import { describe, expect, it } from 'vitest';
import type { DailySnapshot } from '../application/BurndownCalculator.js';
import { BurndownCalculator } from '../application/BurndownCalculator.js';

describe('BurndownCalculator', () => {
  const calculator = new BurndownCalculator();

  const snapshots: DailySnapshot[] = [
    { day: 0, date: '2026-02-16', completedPoints: 0, totalScope: 30 },
    { day: 1, date: '2026-02-17', completedPoints: 5, totalScope: 30 },
    { day: 2, date: '2026-02-18', completedPoints: 12, totalScope: 30 },
    { day: 3, date: '2026-02-19', completedPoints: 20, totalScope: 30 },
  ];

  it('should compute burndown data points', () => {
    const result = calculator.compute(5, snapshots);

    expect(result.burndown).toHaveLength(4);
    expect(result.burndown[0]?.idealRemaining).toBe(30);
    expect(result.burndown[0]?.actualRemaining).toBe(30);
    expect(result.burndown[2]?.actualRemaining).toBe(18); // 30 - 12
  });

  it('should compute burnup data points', () => {
    const result = calculator.compute(5, snapshots);

    expect(result.burnup).toHaveLength(4);
    expect(result.burnup[0]?.completed).toBe(0);
    expect(result.burnup[3]?.completed).toBe(20);
    expect(result.burnup[3]?.scope).toBe(30);
  });

  it('should project completion day', () => {
    const result = calculator.compute(5, snapshots);

    // Velocity = 20/3 = 6.67 pts/day, remaining = 10, days needed = 2
    // Projected = 3 + 2 = 5
    expect(result.projectedCompletionDay).toBe(5);
  });

  it('should return null projection for empty snapshots', () => {
    const result = calculator.compute(5, []);
    expect(result.projectedCompletionDay).toBeNull();
    expect(result.burndown).toHaveLength(0);
  });

  it('should return completed day when all points done', () => {
    const doneSnapshots: DailySnapshot[] = [
      { day: 0, date: '2026-02-16', completedPoints: 0, totalScope: 10 },
      { day: 1, date: '2026-02-17', completedPoints: 10, totalScope: 10 },
    ];
    const result = calculator.compute(5, doneSnapshots);
    expect(result.projectedCompletionDay).toBe(1);
  });
});
