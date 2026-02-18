export interface TokenMeasurement {
  tokensPerSec: number;
  meetsMinimum: boolean;
}

export class TokensPerSecMonitor {
  private measurements = new Map<string, number[]>();

  constructor(
    private readonly minimumTps: number = 15,
    private readonly windowSize: number = 3,
  ) {}

  record(agentName: string, tokens: number, durationMs: number): void {
    const tps = durationMs > 0 ? (tokens / durationMs) * 1000 : 0;
    const existing = this.measurements.get(agentName) ?? [];
    existing.push(tps);

    if (existing.length > this.windowSize) {
      existing.shift();
    }

    this.measurements.set(agentName, existing);
  }

  measure(agentName: string): TokenMeasurement {
    const readings = this.measurements.get(agentName);
    if (!readings || readings.length === 0) {
      return { tokensPerSec: 0, meetsMinimum: false };
    }

    const avg = readings.reduce((sum, v) => sum + v, 0) / readings.length;
    const tokensPerSec = Math.round(avg * 100) / 100;

    return {
      tokensPerSec,
      meetsMinimum: tokensPerSec >= this.minimumTps,
    };
  }

  isEligibleForCeremony(agentName: string): boolean {
    return this.measure(agentName).meetsMinimum;
  }
}
