import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PidFileManager } from '../infrastructure/PidFileManager.js';

describe('PidFileManager', () => {
  let testDir: string;
  let manager: PidFileManager;

  beforeEach(() => {
    testDir = join(tmpdir(), `cop1-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    manager = new PidFileManager(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should write and read a PID', () => {
    manager.write(12345);
    expect(manager.read()).toBe(12345);
  });

  it('should return null if PID file does not exist', () => {
    expect(manager.read()).toBeNull();
  });

  it('should delete the PID file', () => {
    manager.write(12345);
    expect(manager.exists()).toBe(true);
    manager.delete();
    expect(manager.exists()).toBe(false);
    expect(manager.read()).toBeNull();
  });

  it('should create .cop1 directory if missing', () => {
    const cop1Dir = join(testDir, '.cop1');
    expect(existsSync(cop1Dir)).toBe(false);
    manager.write(99);
    expect(existsSync(cop1Dir)).toBe(true);
  });

  it('should detect current process as alive', () => {
    expect(manager.isProcessAlive(process.pid)).toBe(true);
  });

  it('should detect non-existent PID as dead', () => {
    // PID 99999999 is almost certainly not running
    expect(manager.isProcessAlive(99999999)).toBe(false);
  });

  it('should handle delete on non-existent file without error', () => {
    expect(() => manager.delete()).not.toThrow();
  });
});
