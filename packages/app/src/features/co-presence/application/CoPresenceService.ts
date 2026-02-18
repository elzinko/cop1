import type { ConfigPort, EventBus } from '@cop1/shared-kernel';

export class CoPresenceService {
  private coPresenceActive = false;

  constructor(
    private readonly configPort: ConfigPort,
    private readonly eventBus: EventBus,
    private readonly coPresenceThresholdGB: number = 4,
  ) {}

  evaluate(ramTotalGB: number, ramFreeGB: number, cop1RamGB: number): 'day' | 'night' {
    const otherProcessesGB = ramTotalGB - cop1RamGB - ramFreeGB;
    const wasActive = this.coPresenceActive;

    if (otherProcessesGB > this.coPresenceThresholdGB) {
      this.coPresenceActive = true;
      if (!wasActive) {
        this.eventBus.emit('resource.mode_switched', {
          mode: 'day',
          otherProcessesGB: Math.round(otherProcessesGB * 100) / 100,
          budget: this.configPort.get().resources.ram_budget_day_gb,
        });
      }
      return 'day';
    }

    this.coPresenceActive = false;
    if (wasActive) {
      this.eventBus.emit('resource.mode_switched', {
        mode: 'night',
        otherProcessesGB: Math.round(otherProcessesGB * 100) / 100,
        budget: this.configPort.get().resources.ram_budget_night_gb,
      });
    }
    return 'night';
  }

  getActiveBudgetGB(): number {
    const config = this.configPort.get();
    return this.coPresenceActive
      ? config.resources.ram_budget_day_gb
      : config.resources.ram_budget_night_gb;
  }

  get isCoPresence(): boolean {
    return this.coPresenceActive;
  }
}
