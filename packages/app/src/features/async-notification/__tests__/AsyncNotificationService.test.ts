import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus } from '@cop1/shared-kernel';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AsyncNotificationService } from '../application/AsyncNotificationService.js';
import type { AlertPayload } from '../domain/AlertPayload.js';

describe('AsyncNotificationService', () => {
  let testDir: string;
  let eventBus: EventBus;
  let service: AsyncNotificationService;

  beforeEach(() => {
    testDir = join(tmpdir(), `cop1-alerts-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    eventBus = new EventBus();
    service = new AsyncNotificationService(eventBus);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should create alert file', () => {
    const alert: AlertPayload = {
      type: 'blocage',
      storyId: 'S-001',
      message: 'Test blocage',
      severity: 'high',
      createdAt: '2026-01-01T00:00:00Z',
    };

    service.notify(testDir, alert);

    const alerts = service.getAlerts(testDir);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.storyId).toBe('S-001');
    expect(alerts[0]?.type).toBe('blocage');
  });

  it('should read all alerts', () => {
    service.notify(testDir, {
      type: 'blocage',
      storyId: 'S-001',
      message: 'Alert 1',
      severity: 'high',
      createdAt: '2026-01-01T00:00:00Z',
    });
    service.notify(testDir, {
      type: 'dod-failure',
      storyId: 'S-002',
      message: 'Alert 2',
      severity: 'medium',
      createdAt: '2026-01-02T00:00:00Z',
    });

    const alerts = service.getAlerts(testDir);
    expect(alerts).toHaveLength(2);
  });

  it('should create critical blocage alert with high severity', () => {
    const alert = service.criticalBlocageAlert('S-001', 'technical');

    expect(alert.type).toBe('blocage');
    expect(alert.severity).toBe('high');
    expect(alert.storyId).toBe('S-001');
    expect(alert.message).toContain('technical');
  });

  it('should emit alert.created event', () => {
    const handler = vi.fn();
    eventBus.on('alert.created', handler);

    const alert: AlertPayload = {
      type: 'ceremony',
      storyId: 'S-003',
      message: 'Ceremony alert',
      severity: 'low',
      createdAt: '2026-01-03T00:00:00Z',
    };

    service.notify(testDir, alert);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(alert);
  });
});
