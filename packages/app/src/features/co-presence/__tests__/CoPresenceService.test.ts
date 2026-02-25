import type { ConfigPort, Cop1Config } from '@cop1/shared-kernel';
import { EventBus } from '@cop1/shared-kernel';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoPresenceService } from '../application/CoPresenceService.js';

function createConfigPort(): ConfigPort {
  return {
    get: () =>
      ({
        project: { name: 'test', path: '.' },
        daemon: { port: 4242 },
        sprint: { default_duration_hours: 8 },
        resources: {
          ram_budget_night_gb: 48,
          ram_budget_day_gb: 20,
          suspension_threshold_percent: 75,
          polling_interval_ms: 1000,
        },
        llm_routing: {},
        llm_fallback: {},
        git: { auto_merge: false },
        blocage_rules: {},
        schedule: { auto_start: [] },
        workflow: { useBMAD: true },
      }) satisfies Cop1Config,
  };
}

describe('CoPresenceService', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  it('should return night mode when other processes use little RAM', () => {
    const service = new CoPresenceService(createConfigPort(), eventBus, 4);

    service.evaluate(64, 40, 10); // others = 64-10-40 = 14? no: 64-10-40=14

    // Wait, 14GB > 4GB threshold → co-presence!
    // Let's fix: ramTotal=64, ramFree=55, cop1=5 → others=4
    const mode2 = service.evaluate(64, 55, 5); // others = 64-5-55 = 4

    expect(mode2).toBe('night');
  });

  it('should switch to day mode when co-presence detected', () => {
    const handler = vi.fn();
    eventBus.on('resource.mode_switched', handler);

    const service = new CoPresenceService(createConfigPort(), eventBus, 4);
    const mode = service.evaluate(64, 30, 10); // others = 64-10-30 = 24

    expect(mode).toBe('day');
    expect(service.isCoPresence).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('should use day budget when in co-presence', () => {
    const service = new CoPresenceService(createConfigPort(), eventBus, 4);
    service.evaluate(64, 30, 10); // others = 24 → co-presence

    expect(service.getActiveBudgetGB()).toBe(20); // day budget
  });

  it('should use night budget when not in co-presence', () => {
    const service = new CoPresenceService(createConfigPort(), eventBus, 4);
    service.evaluate(64, 58, 2); // others = 4 → no co-presence

    expect(service.getActiveBudgetGB()).toBe(48); // night budget
  });

  it('should emit event when switching back to night mode', () => {
    const handler = vi.fn();
    eventBus.on('resource.mode_switched', handler);

    const service = new CoPresenceService(createConfigPort(), eventBus, 4);
    service.evaluate(64, 30, 10); // switch to day
    service.evaluate(64, 58, 2); // switch back to night

    expect(handler).toHaveBeenCalledTimes(2);
  });
});
