import { cpus, freemem, loadavg, totalmem } from 'node:os';
import type {
  ConfigPort,
  EventBus,
  ResourceMonitorPort,
  ResourceSnapshot,
} from '@cop1/shared-kernel';
import { EventType } from '@cop1/shared-kernel';

export class SystemResourceAdapter implements ResourceMonitorPort {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly eventBus: EventBus,
    private readonly configPort?: ConfigPort,
  ) {}

  snapshot(): ResourceSnapshot {
    const total = totalmem();
    const free = freemem();
    const used = total - free;
    const cpuCount = cpus().length;
    const load1m = loadavg()[0] ?? 0;
    const cpuPercent = Math.min(100, (load1m / cpuCount) * 100);

    return {
      ramUsedGB: Math.round((used / 1e9) * 100) / 100,
      ramTotalGB: Math.round((total / 1e9) * 100) / 100,
      ramPercent: Math.round((used / total) * 10000) / 100,
      cpuPercent: Math.round(cpuPercent * 100) / 100,
      timestamp: new Date(),
    };
  }

  startPolling(intervalMs: number): void {
    this.stop();
    this.intervalId = setInterval(() => {
      const snap = this.snapshot();
      this.eventBus.emit(EventType.RESOURCE_SNAPSHOT, snap);
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getActiveBudgetGB(): number {
    if (!this.configPort) {
      return 48; // default night budget
    }
    // Sprint 0: always night mode. Day sprint mode arrives in E7-S5.
    return this.configPort.get().resources.ram_budget_night_gb;
  }
}
