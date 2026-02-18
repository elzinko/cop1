import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus, type ResourceSnapshot } from '@cop1/shared-kernel';
import { CheckpointService } from '@cop1/sprint-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SuspensionService } from '../application/SuspensionService.js';

function createSnapshot(ramPercent: number): ResourceSnapshot {
  return {
    ramPercent,
    ramUsedGB: ramPercent * 0.64,
    ramTotalGB: 64,
    cpuLoad: [1, 1, 1],
    timestamp: new Date().toISOString(),
  };
}

describe('SuspensionService', () => {
  let testDir: string;
  let eventBus: EventBus;
  let checkpointService: CheckpointService;
  let service: SuspensionService;

  beforeEach(() => {
    testDir = join(tmpdir(), `cop1-susp-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    eventBus = new EventBus();
    checkpointService = new CheckpointService(testDir);
    service = new SuspensionService(eventBus, checkpointService);
  });

  afterEach(() => {
    eventBus.removeAllListeners();
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should suspend when RAM exceeds threshold', () => {
    const handler = vi.fn();
    eventBus.on('system.suspended', handler);

    const result = service.evaluate(createSnapshot(80));

    expect(result).toBe('suspend');
    expect(service.isSuspended).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('should save checkpoint on suspension', () => {
    service.evaluate(createSnapshot(80));

    const checkpoint = checkpointService.read();
    expect(checkpoint).not.toBeNull();
    expect(checkpoint?.stepName).toBe('resource-suspension');
  });

  it('should resume when RAM drops below resume threshold', () => {
    const handler = vi.fn();
    eventBus.on('system.resumed', handler);

    service.evaluate(createSnapshot(80)); // suspend
    const result = service.evaluate(createSnapshot(65)); // resume

    expect(result).toBe('resume');
    expect(service.isSuspended).toBe(false);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('should noop when RAM is between thresholds', () => {
    service.evaluate(createSnapshot(80)); // suspend
    const result = service.evaluate(createSnapshot(72)); // still above resume threshold

    expect(result).toBe('noop');
    expect(service.isSuspended).toBe(true);
  });

  it('should noop when RAM is normal and not suspended', () => {
    const result = service.evaluate(createSnapshot(50));

    expect(result).toBe('noop');
    expect(service.isSuspended).toBe(false);
  });
});
