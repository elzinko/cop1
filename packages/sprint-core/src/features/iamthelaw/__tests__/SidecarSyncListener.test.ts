import { EventBus } from '@cop1/shared-kernel';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SidecarSyncListener } from '../application/SidecarSyncListener.js';
import type { Syncable } from '../application/SidecarSyncListener.js';

function createMockSyncService(): Syncable {
  return { sync: vi.fn() };
}

describe('SidecarSyncListener', () => {
  let eventBus: EventBus;
  let syncService: Syncable;

  beforeEach(() => {
    eventBus = new EventBus();
    syncService = createMockSyncService();
  });

  it('should call sync when rule.applied event is emitted', () => {
    new SidecarSyncListener(eventBus, syncService);

    eventBus.emit('rule.applied', { ruleId: 'R1' });

    expect(syncService.sync).toHaveBeenCalledTimes(1);
  });

  it('should call sync when rule.rejected event is emitted', () => {
    new SidecarSyncListener(eventBus, syncService);

    eventBus.emit('rule.rejected', { ruleId: 'R1' });

    expect(syncService.sync).toHaveBeenCalledTimes(1);
  });

  it('should not propagate sync failures', () => {
    (syncService.sync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Disk full');
    });
    const listener = new SidecarSyncListener(eventBus, syncService);

    expect(() => eventBus.emit('rule.applied', { ruleId: 'R1' })).not.toThrow();

    expect(listener.lastError).toBe('Disk full');
  });

  it('should emit sidecar.sync.failed event on failure', () => {
    (syncService.sync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Permission denied');
    });
    new SidecarSyncListener(eventBus, syncService);

    const failHandler = vi.fn();
    eventBus.on('sidecar.sync.failed', failHandler);

    eventBus.emit('rule.applied', { ruleId: 'R1' });

    expect(failHandler).toHaveBeenCalledTimes(1);
    expect(failHandler).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Permission denied' }),
    );
  });

  it('should trigger sync for each event independently', () => {
    new SidecarSyncListener(eventBus, syncService);

    eventBus.emit('rule.applied', { ruleId: 'R1' });
    eventBus.emit('rule.applied', { ruleId: 'R2' });
    eventBus.emit('rule.rejected', { ruleId: 'R3' });

    expect(syncService.sync).toHaveBeenCalledTimes(3);
  });
});
