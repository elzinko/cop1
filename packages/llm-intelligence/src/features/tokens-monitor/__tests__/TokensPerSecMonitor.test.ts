import { describe, expect, it } from 'vitest';
import { TokensPerSecMonitor } from '../application/TokensPerSecMonitor.js';

describe('TokensPerSecMonitor', () => {
  it('should calculate tokens per second', () => {
    const monitor = new TokensPerSecMonitor(15, 3);
    monitor.record('dev', 150, 1000); // 150 t/s

    const result = monitor.measure('dev');
    expect(result.tokensPerSec).toBe(150);
    expect(result.meetsMinimum).toBe(true);
  });

  it('should average over window', () => {
    const monitor = new TokensPerSecMonitor(15, 3);
    monitor.record('dev', 30, 1000); // 30 t/s
    monitor.record('dev', 15, 1000); // 15 t/s
    monitor.record('dev', 15, 1000); // 15 t/s

    const result = monitor.measure('dev');
    expect(result.tokensPerSec).toBe(20); // avg of 30, 15, 15
  });

  it('should fail minimum for slow agent', () => {
    const monitor = new TokensPerSecMonitor(15, 3);
    monitor.record('dev', 10, 1000); // 10 t/s

    const result = monitor.measure('dev');
    expect(result.meetsMinimum).toBe(false);
  });

  it('should exclude from ceremony when below minimum', () => {
    const monitor = new TokensPerSecMonitor(15, 3);
    monitor.record('dev', 5, 1000);

    expect(monitor.isEligibleForCeremony('dev')).toBe(false);
  });

  it('should return zero for unknown agent', () => {
    const monitor = new TokensPerSecMonitor();
    const result = monitor.measure('unknown');
    expect(result.tokensPerSec).toBe(0);
    expect(result.meetsMinimum).toBe(false);
  });
});
