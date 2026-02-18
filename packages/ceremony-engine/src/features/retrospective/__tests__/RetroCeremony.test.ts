import { existsSync, readFileSync } from 'node:fs';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus } from '@cop1/shared-kernel';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type RetroAnalyzer,
  RetroCeremony,
  type RetroInput,
} from '../application/RetroCeremony.js';
import { RetroOutputMissingError } from '../domain/RetroTypes.js';

const defaultInput: RetroInput = {
  sprintMetrics: { storiesCompleted: 10, storiesPlanned: 12, blocages: 2, gateFailures: 1 },
};

function createAnalyzer(rules = 1, stories = 1): RetroAnalyzer {
  return {
    analyze: async () => ({
      architectureRules: Array.from({ length: rules }, (_, i) => ({
        type: 'architecture-rule' as const,
        rule: `Rule ${i + 1}`,
        reason: 'Improve stability',
        status: 'pending_review' as const,
      })),
      refactoringStories: Array.from({ length: stories }, (_, i) => ({
        type: 'refactoring-story' as const,
        title: `Refactor ${i + 1}`,
        description: 'Clean up tech debt',
        status: 'pending_review' as const,
      })),
    }),
  };
}

describe('RetroCeremony', () => {
  let testDir: string;
  let eventBus: EventBus;

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `cop1-retro-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(testDir, { recursive: true });
    eventBus = new EventBus();
  });

  afterEach(() => {
    eventBus.removeAllListeners();
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should produce proposals and persist them', async () => {
    const ceremony = new RetroCeremony(testDir, eventBus, createAnalyzer());

    const proposals = await ceremony.run(defaultInput);

    expect(proposals).toHaveLength(2);
    const filePath = join(testDir, '.cop1', 'improvement-decisions.jsonl');
    expect(existsSync(filePath)).toBe(true);
    const lines = readFileSync(filePath, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(2);
  });

  it('should emit SSE events for each proposal', async () => {
    const handler = vi.fn();
    eventBus.on('improvement.suggestion.submitted', handler);

    const ceremony = new RetroCeremony(testDir, eventBus, createAnalyzer(2, 1));
    await ceremony.run(defaultInput);

    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('should throw RetroOutputMissingError when no architecture rules', async () => {
    const ceremony = new RetroCeremony(testDir, eventBus, createAnalyzer(0, 1));

    await expect(ceremony.run(defaultInput)).rejects.toThrow(RetroOutputMissingError);
  });

  it('should throw RetroOutputMissingError when no refactoring stories', async () => {
    const ceremony = new RetroCeremony(testDir, eventBus, createAnalyzer(1, 0));

    await expect(ceremony.run(defaultInput)).rejects.toThrow(RetroOutputMissingError);
  });
});
