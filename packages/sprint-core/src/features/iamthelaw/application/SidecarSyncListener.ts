import type { EventBus } from '@cop1/shared-kernel';

/** Contract for a service that can sync rules to the sidecar. */
export interface Syncable {
  sync(): void;
}

/** Listens to rule change events and triggers sidecar sync. Error-resilient — never blocks rule processing. */
export class SidecarSyncListener {
  /** Last sync error message, or undefined if last sync succeeded. */
  lastError: string | undefined;

  constructor(
    private readonly eventBus: EventBus,
    private readonly syncService: Syncable,
  ) {
    this.eventBus.on('rule.applied', () => this.handleSync());
    this.eventBus.on('rule.rejected', () => this.handleSync());
  }

  private handleSync(): void {
    try {
      this.syncService.sync();
      this.lastError = undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = message;
      console.error(`[SidecarSyncListener] Sync failed: ${message}`);
      this.eventBus.emit('sidecar.sync.failed', { error: message });
    }
  }
}
