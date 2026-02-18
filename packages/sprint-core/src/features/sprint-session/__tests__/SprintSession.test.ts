import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SprintSessionService } from '../application/SprintSessionService.js';
import { parseDuration } from '../domain/SprintSession.js';

describe('SprintSession', () => {
  let testDir: string;
  let service: SprintSessionService;

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `cop1-session-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(testDir, { recursive: true });
    service = new SprintSessionService(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should start a session and create session.yaml', () => {
    const session = service.start(120);

    expect(session.durationMinutes).toBe(120);
    expect(session.status).toBe('active');
    expect(service.isActive()).toBe(true);
  });

  it('should detect expired session', () => {
    // Start a session with 0 minutes duration (already expired)
    service.start(0);

    // Small delay to ensure deadline has passed
    const session = service.check();
    expect(session?.status).toBe('expired');
    expect(service.isActive()).toBe(false);
  });

  it('should stop a session', () => {
    service.start(120);
    service.stop();

    const session = service.check();
    expect(session?.status).toBe('completed');
  });

  it('should return null when no session exists', () => {
    expect(service.check()).toBeNull();
    expect(service.isActive()).toBe(false);
  });

  it('should parse duration strings correctly', () => {
    expect(parseDuration('1h')).toBe(60);
    expect(parseDuration('2h')).toBe(120);
    expect(parseDuration('30m')).toBe(30);
    expect(parseDuration('4h')).toBe(240);
  });

  it('should throw on invalid duration format', () => {
    expect(() => parseDuration('abc')).toThrow('Invalid duration format');
    expect(() => parseDuration('2d')).toThrow('Invalid duration format');
  });
});
