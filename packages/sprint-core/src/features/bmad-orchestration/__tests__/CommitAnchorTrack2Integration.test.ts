import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus } from '@cop1/shared-kernel';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorktreeService } from '../../dev-agent/application/WorktreeService.js';
import type { HistoryService } from '../application/HistoryService.js';
import type { ExchangeRecord } from '../domain/HistoryRecords.js';
import type { BMADSessionPort } from '../domain/ports/BMADSessionPort.js';
import { ExchangeHistoryWriter } from '../infrastructure/ExchangeHistoryWriter.js';
import {
  type GitDriver,
  buildSupervisorToolHandlers,
} from '../infrastructure/tools/toolCatalog.js';

/**
 * EA12-S6 AC2 — integration: commit_anchor SHA flows into Track 2 frontmatter.
 *
 * End-to-end assembly of the pieces introduced by EA12-S1 (commit_anchor real)
 * and EA12-S6 (extended frontmatter). No real git; a fake GitDriver provides a
 * deterministic SHA. The test proves the wiring contract the
 * orchestrator / caller must uphold: invoke commit_anchor, take the SHA,
 * thread it into the ExchangeFrontMatter.
 */

function makeToolDeps(): Parameters<typeof buildSupervisorToolHandlers>[0] {
  return {
    worktree: { create: vi.fn(), cleanup: vi.fn() } as unknown as WorktreeService,
    sessionPort: {
      startSession: vi.fn(),
      continueSession: vi.fn(),
    } as unknown as BMADSessionPort,
    history: { byStory: vi.fn(), bySession: vi.fn() } as unknown as HistoryService,
    projectRoot: '/proj',
    eventBus: new EventBus(),
  };
}

describe('EA12-S6 ↔ EA12-S1: commit_anchor SHA → Track 2 frontmatter', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'commit-anchor-track2-'));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('flows SHA from commit_anchor result into the next Track 2 write', async () => {
    // Arrange: a fake GitDriver so commit_anchor returns a known SHA.
    const fakeSha = '1234567890abcdef1234567890abcdef12345678';
    const git: GitDriver = {
      hasStagedChanges: () => true,
      commit: () => {},
      headSha: () => fakeSha,
    };
    const handlers = buildSupervisorToolHandlers({ ...makeToolDeps(), gitDriver: git });

    // Act 1: orchestrator calls commit_anchor.
    const anchor = await handlers.commit_anchor({
      message: 'feat(ea12-s6): extended Track 2',
    });
    if (!anchor.committed) throw new Error('expected committed=true');
    expect(anchor.sha).toBe(fakeSha);
    expect(anchor.short_sha).toBe(fakeSha.slice(0, 7));

    // Act 2: orchestrator writes the Track 2 file, threading the SHA.
    const writer = new ExchangeHistoryWriter(tmp);
    const record: ExchangeRecord = {
      frontMatter: {
        sessionId: 'sess-1',
        storyId: 'EA12-S6',
        sprintId: 'sprint-13',
        command: '/bmad-bmm-code-review',
        startedAt: '2026-04-15T12:00:00.000Z',
        endedAt: '2026-04-15T12:05:00.000Z',
        supervisorTurns: 1,
        status: 'success',
        commit: anchor.sha,
      },
      interactions: [],
    };
    const path = await writer.write(record);

    // Assert: the written markdown carries the SHA in frontmatter.
    const content = await readFile(path, 'utf-8');
    expect(content).toContain(`commit: ${JSON.stringify(fakeSha)}`);
    expect(content).toContain('session_id: "sess-1"');
    expect(content).toContain('story_id: "EA12-S6"');
  });

  it('omits commit when commit_anchor returned nothing_to_commit (no SHA available)', async () => {
    const git: GitDriver = {
      hasStagedChanges: () => false,
      commit: () => {
        throw new Error('should not be called');
      },
      headSha: () => 'unreachable',
    };
    const handlers = buildSupervisorToolHandlers({ ...makeToolDeps(), gitDriver: git });
    const result = await handlers.commit_anchor({ message: 'noop' });
    if (result.committed) throw new Error('expected committed=false');
    expect(result.reason).toBe('nothing_to_commit');

    const writer = new ExchangeHistoryWriter(tmp);
    const record: ExchangeRecord = {
      frontMatter: {
        sessionId: 'sess-1',
        storyId: 'EA12-S6',
        sprintId: 'sprint-13',
        command: '/bmad-bmm-code-review',
        startedAt: '2026-04-15T12:00:00.000Z',
        endedAt: '2026-04-15T12:05:00.000Z',
        supervisorTurns: 1,
        status: 'success',
        // commit deliberately omitted — no SHA from commit_anchor.
      },
      interactions: [],
    };
    const path = await writer.write(record);
    const content = await readFile(path, 'utf-8');
    expect(content).not.toMatch(/\ncommit:/);
  });
});
