export type DaemonStatus = 'running' | 'stopped' | 'unknown';

export interface PidInfo {
  pid: number;
  startedAt: Date;
}

export interface HealthInfo {
  status: 'ok';
  uptime: number;
  version: string;
  pid: number;
}

export const COP1_VERSION = '0.1.0';
export const DEFAULT_PORT = 4242;
export const PID_FILENAME = 'daemon.pid';
export const COP1_DIR = '.cop1';
