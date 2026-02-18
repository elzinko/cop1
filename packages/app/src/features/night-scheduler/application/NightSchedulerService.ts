export interface ScheduleEntry {
  days: string[];
  start_time: string;
  duration_hours: number;
}

export interface ScheduleResult {
  scheduled: boolean;
  reason?: string;
  nextStart?: Date;
}

export class NightSchedulerService {
  private manualSessionActive = false;

  constructor(private readonly schedules: ScheduleEntry[]) {}

  setManualSessionActive(active: boolean): void {
    this.manualSessionActive = active;
  }

  shouldStart(now: Date = new Date()): ScheduleResult {
    if (this.manualSessionActive) {
      return { scheduled: false, reason: 'manual_session_active' };
    }

    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (const entry of this.schedules) {
      const matchesDay = entry.days.some((d) => d.toLowerCase() === dayName);
      if (!matchesDay) continue;

      if (currentTime === entry.start_time) {
        return { scheduled: true, nextStart: now };
      }
    }

    return { scheduled: false };
  }

  getNextScheduled(now: Date = new Date()): Date | null {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    let closest: Date | null = null;

    for (const entry of this.schedules) {
      for (let daysAhead = 0; daysAhead < 7; daysAhead++) {
        const candidate = new Date(now);
        candidate.setDate(candidate.getDate() + daysAhead);
        const dayName = dayNames[candidate.getDay()] ?? '';

        if (!entry.days.some((d) => d.toLowerCase() === dayName)) continue;

        const [hours, minutes] = entry.start_time.split(':').map(Number);
        candidate.setHours(hours ?? 0, minutes ?? 0, 0, 0);

        if (candidate <= now) continue;

        if (!closest || candidate < closest) {
          closest = candidate;
        }
      }
    }

    return closest;
  }
}
