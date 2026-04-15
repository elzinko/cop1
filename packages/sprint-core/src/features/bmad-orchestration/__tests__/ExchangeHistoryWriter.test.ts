import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ExchangeRecord } from '../domain/HistoryRecords.js';
import { ExchangeHistoryWriter } from '../infrastructure/ExchangeHistoryWriter.js';

function record(over: Partial<ExchangeRecord> = {}): ExchangeRecord {
  return {
    frontMatter: {
      sessionId: 'sess-1',
      storyId: 'EA11-S8',
      sprintId: 'sprint-12',
      command: '/bmad-bmm-dev-story',
      startedAt: '2026-04-14T18:00:00.000Z',
      endedAt: '2026-04-14T18:05:00.000Z',
      supervisorTurns: 2,
      status: 'success',
      ...(over.frontMatter ?? {}),
    },
    interactions: over.interactions ?? [
      {
        timestamp: '2026-04-14T18:00:00.000Z',
        sessionId: 'sess-1',
        storyId: 'EA11-S8',
        epicId: 'EA11',
        workflowCommand: '/bmad-bmm-dev-story',
        turn: 1,
        role: 'supervisor',
        content: 'Proceed.',
        analysis: { type: 'question_simple', method: 'deterministic' },
        durationMs: 10,
      },
    ],
  };
}

describe('ExchangeHistoryWriter', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'exchange-writer-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes a Track 2 markdown file at the expected path', async () => {
    const writer = new ExchangeHistoryWriter(dir);
    const path = await writer.write(record());
    expect(path).toContain(join('.cop1', 'history', 'sprint-12', 'EA11-S8'));
    const content = await readFile(path, 'utf-8');
    expect(content).toMatch(/^---\n/);
    expect(content).toContain('session_id: "sess-1"');
    expect(content).toContain('status: success');
    expect(content).toContain('turn 1 — supervisor (deterministic)');
  });

  it('escapes body content starting with --- via sentinel marker', async () => {
    const writer = new ExchangeHistoryWriter(dir);
    const path = await writer.write(record());
    const content = await readFile(path, 'utf-8');
    expect(content).toContain('<!-- cop1:body-start -->');
  });

  it('sanitizes command slashes in filename', async () => {
    const writer = new ExchangeHistoryWriter(dir);
    const path = await writer.write(record());
    expect(path).not.toContain('/bmad-bmm');
    expect(path).toContain('_bmad-bmm-dev-story');
  });

  it('handles empty interactions gracefully', async () => {
    const writer = new ExchangeHistoryWriter(dir);
    const path = await writer.write(record({ interactions: [] }));
    const content = await readFile(path, 'utf-8');
    expect(content).toContain('_No interactions recorded._');
  });

  it('EA12-S6: frontmatter carries commit SHA when provided', async () => {
    const writer = new ExchangeHistoryWriter(dir);
    const path = await writer.write(
      record({
        frontMatter: {
          sessionId: 'sess-1',
          storyId: 'EA12-S1',
          sprintId: 'sprint-13',
          command: '/bmad-bmm-dev-story',
          startedAt: '2026-04-15T12:00:00.000Z',
          endedAt: '2026-04-15T12:05:00.000Z',
          supervisorTurns: 1,
          status: 'success',
          commit: 'abcdef1234567890abcdef1234567890abcdef12',
        },
      }),
    );
    const content = await readFile(path, 'utf-8');
    expect(content).toContain('commit: "abcdef1234567890abcdef1234567890abcdef12"');
  });

  it('EA12-S6: frontmatter omits commit line when absent (backwards compat)', async () => {
    const writer = new ExchangeHistoryWriter(dir);
    const path = await writer.write(record());
    const content = await readFile(path, 'utf-8');
    expect(content).not.toMatch(/\ncommit:/);
  });

  it('EA12-S6: renders shellCommand with return code + stderr (truncated at 500 chars)', async () => {
    const writer = new ExchangeHistoryWriter(dir);
    const longStderr = 'x'.repeat(1000);
    const path = await writer.write(
      record({
        interactions: [
          {
            timestamp: '2026-04-15T12:00:00.000Z',
            sessionId: 'sess-1',
            storyId: 'EA12-S6',
            epicId: 'EA12',
            workflowCommand: '/bmad-bmm-dev-story',
            turn: 1,
            role: 'supervisor',
            content: 'Running pnpm test.',
            analysis: { type: 'completion', method: 'llm' },
            durationMs: 10,
            shellCommand: {
              command: 'pnpm test',
              returnCode: 1,
              stderr: longStderr,
              cwd: '/tmp/proj',
              ts: '2026-04-15T12:00:01.000Z',
            },
          },
        ],
      }),
    );
    const content = await readFile(path, 'utf-8');
    expect(content).toContain('#### Shell');
    expect(content).toContain('`$ pnpm test`');
    expect(content).toContain('return code:* `1`');
    expect(content).toContain('/tmp/proj');
    // Truncated stderr (500-char cap → ends with …)
    expect(content).toContain('...');
    expect(content).not.toContain('x'.repeat(501)); // never emits more than the truncated slice
  });

  it('EA12-S6: renders blocker subsection when set', async () => {
    const writer = new ExchangeHistoryWriter(dir);
    const path = await writer.write(
      record({
        interactions: [
          {
            timestamp: '2026-04-15T12:00:00.000Z',
            sessionId: 'sess-1',
            storyId: 'EA12-S6',
            epicId: 'EA12',
            workflowCommand: '/bmad-bmm-dev-story',
            turn: 1,
            role: 'supervisor',
            content: 'Escalating.',
            analysis: { type: 'escalation', method: 'escalation' },
            durationMs: 1,
            blocker: { reason: 'DoR gap', detail: 'AC3 ambiguous' },
          },
        ],
      }),
    );
    const content = await readFile(path, 'utf-8');
    expect(content).toContain('#### Blocker');
    expect(content).toContain('**reason:** DoR gap');
    expect(content).toContain('**detail:** AC3 ambiguous');
  });

  it('EA12-S6: renders gate result subsection (pass + fail)', async () => {
    const writer = new ExchangeHistoryWriter(dir);
    const path = await writer.write(
      record({
        interactions: [
          {
            timestamp: '2026-04-15T12:00:00.000Z',
            sessionId: 'sess-1',
            storyId: 'EA12-S6',
            epicId: 'EA12',
            workflowCommand: '/bmad-bmm-dev-story',
            turn: 1,
            role: 'supervisor',
            content: 'Gate check.',
            analysis: { type: 'completion', method: 'deterministic' },
            durationMs: 1,
            gateResult: { name: 'typecheck', pass: true },
          },
          {
            timestamp: '2026-04-15T12:00:01.000Z',
            sessionId: 'sess-1',
            storyId: 'EA12-S6',
            epicId: 'EA12',
            workflowCommand: '/bmad-bmm-dev-story',
            turn: 2,
            role: 'supervisor',
            content: 'Gate check.',
            analysis: { type: 'completion', method: 'deterministic' },
            durationMs: 1,
            gateResult: { name: 'test', pass: false, detail: '3 failing' },
          },
        ],
      }),
    );
    const content = await readFile(path, 'utf-8');
    expect(content).toContain('**typecheck:** PASS');
    expect(content).toContain('**test:** FAIL');
    expect(content).toContain('3 failing');
  });
});
