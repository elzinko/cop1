import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WSJFInput } from '../application/WSJFService.js';
import { WSJFService } from '../application/WSJFService.js';

describe('WSJFService', () => {
  let testDir: string;
  let service: WSJFService;

  beforeEach(() => {
    testDir = join(tmpdir(), `cop1-wsjf-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(testDir, '.cop1'), { recursive: true });
    service = new WSJFService(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should calculate WSJF score', () => {
    const input: WSJFInput = {
      storyId: 'S1',
      businessValue: 8,
      timeCriticality: 5,
      riskReduction: 3,
      jobSize: 5,
    };

    const result = service.score(input);
    expect(result.wsjf).toBe(3.2); // (8+5+3)/5
    expect(result.storyId).toBe('S1');
  });

  it('should prevent division by zero', () => {
    const input: WSJFInput = {
      storyId: 'S1',
      businessValue: 10,
      timeCriticality: 5,
      riskReduction: 3,
      jobSize: 0,
    };

    const result = service.score(input);
    expect(result.wsjf).toBe(18); // (10+5+3)/1
  });

  it('should persist and use overrides', () => {
    const original: WSJFInput = {
      storyId: 'S1',
      businessValue: 5,
      timeCriticality: 5,
      riskReduction: 5,
      jobSize: 5,
    };

    const override: WSJFInput = {
      storyId: 'S1',
      businessValue: 10,
      timeCriticality: 10,
      riskReduction: 10,
      jobSize: 5,
    };

    service.setOverride(override);
    const result = service.score(original);
    expect(result.wsjf).toBe(6); // (10+10+10)/5 from override
  });

  it('should use original when no override exists', () => {
    const input: WSJFInput = {
      storyId: 'S2',
      businessValue: 3,
      timeCriticality: 3,
      riskReduction: 3,
      jobSize: 3,
    };

    const result = service.score(input);
    expect(result.wsjf).toBe(3); // (3+3+3)/3
  });
});
