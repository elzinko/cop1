import type { ResourceSnapshot } from '../types/ResourceSnapshot.js';

export interface ResourceMonitorPort {
  snapshot(): ResourceSnapshot;
  startPolling(intervalMs: number): void;
  stop(): void;
  getActiveBudgetGB(): number;
}
