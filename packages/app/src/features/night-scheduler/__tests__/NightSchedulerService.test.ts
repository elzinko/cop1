import { describe, expect, it } from 'vitest';
import { NightSchedulerService } from '../application/NightSchedulerService.js';

describe('NightSchedulerService', () => {
  const schedules = [
    { days: ['monday', 'wednesday', 'friday'], start_time: '02:00', duration_hours: 6 },
    { days: ['saturday'], start_time: '22:00', duration_hours: 8 },
  ];

  it('should schedule when matching day and time', () => {
    const service = new NightSchedulerService(schedules);
    // Create a Monday at 02:00
    const monday = new Date('2026-02-16T02:00:00'); // Monday
    const result = service.shouldStart(monday);

    expect(result.scheduled).toBe(true);
  });

  it('should not schedule when manual session is active', () => {
    const service = new NightSchedulerService(schedules);
    service.setManualSessionActive(true);

    const monday = new Date('2026-02-16T02:00:00');
    const result = service.shouldStart(monday);

    expect(result.scheduled).toBe(false);
    expect(result.reason).toBe('manual_session_active');
  });

  it('should not schedule on non-matching day', () => {
    const service = new NightSchedulerService(schedules);
    const tuesday = new Date('2026-02-17T02:00:00'); // Tuesday
    const result = service.shouldStart(tuesday);

    expect(result.scheduled).toBe(false);
  });

  it('should find next scheduled time', () => {
    const service = new NightSchedulerService(schedules);
    const tuesday = new Date('2026-02-17T10:00:00'); // Tuesday 10am
    const next = service.getNextScheduled(tuesday);

    expect(next).not.toBeNull();
    // Next should be Wednesday 02:00
    expect(next?.getDay()).toBe(3); // Wednesday
  });
});
