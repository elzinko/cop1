import type { ResourceMonitorPort } from '@cop1/shared-kernel';

const DEFAULT_INTERVAL_MS = 5000;

export class ResourceMonitorService {
  constructor(private readonly monitor: ResourceMonitorPort) {}

  start(intervalMs: number = DEFAULT_INTERVAL_MS): void {
    this.monitor.startPolling(intervalMs);
  }

  stop(): void {
    this.monitor.stop();
  }

  snapshot() {
    return this.monitor.snapshot();
  }

  getActiveBudgetGB(): number {
    return this.monitor.getActiveBudgetGB();
  }
}
