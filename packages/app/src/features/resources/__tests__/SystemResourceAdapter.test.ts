import type { ConfigPort, Cop1Config } from '@cop1/shared-kernel';
import { EventBus, EventType } from '@cop1/shared-kernel';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SystemResourceAdapter } from '../infrastructure/SystemResourceAdapter.js';

describe('SystemResourceAdapter', () => {
  let eventBus: EventBus;
  let adapter: SystemResourceAdapter;

  beforeEach(() => {
    eventBus = new EventBus();
    adapter = new SystemResourceAdapter(eventBus);
  });

  afterEach(() => {
    adapter.stop();
    eventBus.removeAllListeners();
  });

  it('should return a valid resource snapshot', () => {
    const snap = adapter.snapshot();

    expect(snap.ramUsedGB).toBeGreaterThan(0);
    expect(snap.ramTotalGB).toBeGreaterThan(snap.ramUsedGB);
    expect(snap.ramPercent).toBeGreaterThan(0);
    expect(snap.ramPercent).toBeLessThanOrEqual(100);
    expect(typeof snap.cpuPercent).toBe('number');
    expect(snap.timestamp).toBeInstanceOf(Date);
  });

  it('should complete snapshot in less than 100ms', () => {
    const start = performance.now();
    adapter.snapshot();
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
  });

  it('should emit resource.snapshot events when polling', async () => {
    const received: unknown[] = [];
    eventBus.on(EventType.RESOURCE_SNAPSHOT, (payload) => {
      received.push(payload);
    });

    adapter.startPolling(100);

    // Wait for at least 2 events
    await new Promise((r) => setTimeout(r, 350));

    adapter.stop();
    expect(received.length).toBeGreaterThanOrEqual(2);
  });

  it('should stop emitting events after stop()', async () => {
    const received: unknown[] = [];
    eventBus.on(EventType.RESOURCE_SNAPSHOT, (payload) => {
      received.push(payload);
    });

    adapter.startPolling(100);
    await new Promise((r) => setTimeout(r, 250));
    adapter.stop();

    const countAtStop = received.length;
    await new Promise((r) => setTimeout(r, 300));

    expect(received.length).toBe(countAtStop);
  });

  it('should return default budget when no configPort', () => {
    expect(adapter.getActiveBudgetGB()).toBe(48);
  });

  it('should return night budget from config', () => {
    const mockConfig: Cop1Config = {
      project: { name: 'test', path: '.' },
      daemon: { port: 4242 },
      sprint: { default_duration_hours: 8 },
      resources: {
        ram_budget_night_gb: 32,
        ram_budget_day_gb: 16,
        suspension_threshold_percent: 75,
        polling_interval_ms: 1000,
      },
      llm_routing: {},
      llm_fallback: {},
      git: { auto_merge: false },
      blocage_rules: {},
      schedule: { auto_start: [] },
      workflow: { useBMAD: true },
    };
    const configPort: ConfigPort = { get: () => mockConfig };
    const adapterWithConfig = new SystemResourceAdapter(eventBus, configPort);

    expect(adapterWithConfig.getActiveBudgetGB()).toBe(32);
  });
});
