import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PMDecisionService } from '../application/PMDecisionService.js';

describe('PMDecisionService', () => {
  let testDir: string;
  let service: PMDecisionService;

  beforeEach(() => {
    testDir = join(tmpdir(), `cop1-decision-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    service = new PMDecisionService(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should persist a pending question', () => {
    const decision = service.persistQuestion('S1', 'Which auth method?', 'OAuth vs JWT');

    expect(decision.status).toBe('pending');
    expect(decision.storyId).toBe('S1');
    expect(decision.question).toBe('Which auth method?');
  });

  it('should list pending decisions', () => {
    service.persistQuestion('S1', 'Question 1', 'Context 1');
    service.persistQuestion('S2', 'Question 2', 'Context 2');

    const pending = service.getPending();
    expect(pending).toHaveLength(2);
  });

  it('should answer a pending decision', () => {
    service.persistQuestion('S1', 'Which method?', 'Context');
    const answered = service.answer('S1', 'Use JWT');

    expect(answered?.status).toBe('answered');
    expect(answered?.answer).toBe('Use JWT');
  });

  it('should exclude answered decisions from pending list', () => {
    service.persistQuestion('S1', 'Question', 'Context');
    service.answer('S1', 'Answer');

    const pending = service.getPending();
    expect(pending).toHaveLength(0);
  });
});
