import type { BurndownDataPoint, BurnupDataPoint, ChartData } from '../domain/BurndownTypes.js';

export interface DailySnapshot {
  day: number;
  date: string;
  completedPoints: number;
  totalScope: number;
}

export class BurndownCalculator {
  compute(totalDays: number, snapshots: DailySnapshot[]): ChartData {
    if (snapshots.length === 0 || totalDays <= 0) {
      return { burndown: [], burnup: [], projectedCompletionDay: null };
    }

    const first = snapshots[0];
    if (!first) return { burndown: [], burnup: [], projectedCompletionDay: null };
    const totalScope = first.totalScope;
    const idealDecrement = totalScope / totalDays;

    const burndown: BurndownDataPoint[] = [];
    const burnup: BurnupDataPoint[] = [];

    for (const snapshot of snapshots) {
      const idealRemaining = Math.max(0, totalScope - idealDecrement * snapshot.day);

      burndown.push({
        day: snapshot.day,
        date: snapshot.date,
        idealRemaining: Math.round(idealRemaining * 10) / 10,
        actualRemaining: snapshot.totalScope - snapshot.completedPoints,
      });

      burnup.push({
        day: snapshot.day,
        date: snapshot.date,
        scope: snapshot.totalScope,
        completed: snapshot.completedPoints,
      });
    }

    const projectedCompletionDay = this.projectCompletion(snapshots, totalDays);

    return { burndown, burnup, projectedCompletionDay };
  }

  private projectCompletion(snapshots: DailySnapshot[], totalDays: number): number | null {
    if (snapshots.length < 2) return null;

    const last = snapshots[snapshots.length - 1];
    if (!last) return null;
    if (last.completedPoints >= last.totalScope) return last.day;

    const velocity = last.completedPoints / Math.max(1, last.day);
    if (velocity <= 0) return null;

    const remainingPoints = last.totalScope - last.completedPoints;
    const daysNeeded = Math.ceil(remainingPoints / velocity);
    const projectedDay = last.day + daysNeeded;

    return projectedDay > totalDays * 3 ? null : projectedDay;
  }
}
