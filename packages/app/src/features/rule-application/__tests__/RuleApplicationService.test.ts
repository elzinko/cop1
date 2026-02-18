import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  DuplicateRuleError,
  RuleApplicationService,
} from '../application/RuleApplicationService.js';

describe('RuleApplicationService', () => {
  let testDir: string;
  let service: RuleApplicationService;

  beforeEach(() => {
    testDir = join(tmpdir(), `cop1-rules-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    service = new RuleApplicationService(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should apply an architecture rule', () => {
    service.apply({
      type: 'architecture',
      ruleId: 'ARCH-001',
      payload: { description: 'No circular deps', reason: 'Maintainability' },
    });

    const filePath = join(testDir, 'iamthelaw/architecture.yaml');
    expect(existsSync(filePath)).toBe(true);
    const data = parse(readFileSync(filePath, 'utf-8')) as { rules: Array<{ id: string }> };
    expect(data.rules[0]?.id).toBe('ARCH-001');
  });

  it('should reject duplicate rule', () => {
    service.apply({
      type: 'architecture',
      ruleId: 'ARCH-001',
      payload: { description: 'Rule 1' },
    });

    expect(() =>
      service.apply({
        type: 'architecture',
        ruleId: 'ARCH-001',
        payload: { description: 'Duplicate' },
      }),
    ).toThrow(DuplicateRuleError);
  });

  it('should write audit log on success', () => {
    service.apply({
      type: 'team',
      ruleId: 'TEAM-001',
      payload: { description: 'Daily standup' },
    });

    const historyPath = join(testDir, 'iamthelaw/history.jsonl');
    const lines = readFileSync(historyPath, 'utf-8').trim().split('\n');
    const entry = JSON.parse(lines[0] ?? '{}');
    expect(entry.status).toBe('applied');
    expect(entry.proposal_type).toBe('team');
  });

  it('should write audit log on failure', () => {
    service.apply({
      type: 'architecture',
      ruleId: 'ARCH-001',
      payload: { description: 'Rule' },
    });

    try {
      service.apply({
        type: 'architecture',
        ruleId: 'ARCH-001',
        payload: { description: 'Duplicate' },
      });
    } catch {
      // expected
    }

    const historyPath = join(testDir, 'iamthelaw/history.jsonl');
    const lines = readFileSync(historyPath, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(2);
    const failEntry = JSON.parse(lines[1] ?? '{}');
    expect(failEntry.status).toBe('failed');
  });
});
