export interface ResourceSnapshot {
  ramUsedGB: number;
  ramTotalGB: number;
  ramPercent: number;
  cpuPercent: number;
  timestamp: Date;
}
