import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CheckpointService } from '../application/CheckpointService.js';
import type { CheckpointState } from '../domain/CheckpointState.js';

describe('CheckpointService', () => {
  let testDir: string;
  let service: CheckpointService;

  beforeEach(() => {
    testDir = join(tmpdir(), `cop1-cp-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    service = new CheckpointService(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should save and read a checkpoint', () => {
    const state: CheckpointState = {
      storyId: 'E1-S1',
      agentName: 'dev',
      stepIndex: 1,
      stepName: 'reviewer',
      timestamp: new Date().toISOString(),
      phase: 'agent.started',
    };

    service.save(state);
    const read = service.read();

    expect(read).not.toBeNull();
    expect(read?.storyId).toBe('E1-S1');
    expect(read?.stepIndex).toBe(1);
    expect(read?.phase).toBe('agent.started');
  });

  it('should return null when no checkpoint exists', () => {
    expect(service.read()).toBeNull();
  });

  it('should clear the checkpoint', () => {
    service.save({
      storyId: 'E1-S1',
      agentName: 'dev',
      stepIndex: 0,
      stepName: 'dev',
      timestamp: new Date().toISOString(),
      phase: 'agent.started',
    });

    service.clear();
    expect(service.read()).toBeNull();
  });

  it('should use atomic write (no .tmp left after save)', () => {
    service.save({
      storyId: 'E1-S1',
      agentName: 'dev',
      stepIndex: 0,
      stepName: 'dev',
      timestamp: new Date().toISOString(),
      phase: 'transition',
    });

    expect(existsSync(join(testDir, '.cop1/checkpoint.yaml.tmp'))).toBe(false);
    expect(existsSync(join(testDir, '.cop1/checkpoint.yaml'))).toBe(true);
  });

  it('should overwrite existing checkpoint', () => {
    service.save({
      storyId: 'E1-S1',
      agentName: 'dev',
      stepIndex: 0,
      stepName: 'dev',
      timestamp: new Date().toISOString(),
      phase: 'agent.started',
    });

    service.save({
      storyId: 'E1-S1',
      agentName: 'reviewer',
      stepIndex: 1,
      stepName: 'reviewer',
      timestamp: new Date().toISOString(),
      phase: 'agent.started',
    });

    const read = service.read();
    expect(read?.agentName).toBe('reviewer');
    expect(read?.stepIndex).toBe(1);
  });
});
