import { EventBus } from '@cop1/shared-kernel';
import {
  InMemorySessionAdapter,
  InMemorySupervisorAdapter,
  SessionLogger,
  SupervisorService,
} from '@cop1/sprint-core';
import { StructuredLogger } from '@cop1/observability';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { orchestratorRunCommand } from '../cli/commands/orchestrator.js';
import { createDefaultBMADCommandRunner } from '../features/orchestrator/infrastructure/DefaultBMADCommandRunner.js';

/**
 * EA13-S3 — re-run of the 2026-04-16 empirical shakedown procedure, as a
 * CI-sized integration test. Asserts what can be observed without a real
 * SDK: state transitions, JSONL sprint log shape, exit code.
 *
 * What this test does NOT cover (tracked in `scripts/ea13-real-run.sh` and
 * `deferred-EA13.md`):
 *   - Real git commits with Co-Authored-By trailer (requires live SDK
 *     session invoking the commit_anchor tool).
 *   - `.cop1/history/<story>/track{1,2,3}/` track files (same reason —
 *     emitted by SessionLogger when real turns fire).
 *   - Story body mirror update (`## Status: done`) — that's EA13-S4.
 */

async function seedSandbox(projectRoot: string, storyKey: string): Promise<void> {
  await writeFile(
    join(projectRoot, 'supervisor-playbook.md'),
    [
      'BMAD version: 6.0.0-Beta.8',
      'help: /bmad-help',
      '',
      '## Mission',
      'Smoke test.',
      '',
      '## Development Loop',
      'Canonical scrum cycle.',
      '',
      '## Escalation Policy',
      'Escalate on reentrance cap or budget exhaustion.',
      '',
    ].join('\n'),
  );
  const artifacts = join(projectRoot, '_bmad-output', 'implementation-artifacts');
  await mkdir(artifacts, { recursive: true });
  await writeFile(
    join(artifacts, 'sprint-status.yaml'),
    [
      'generated: 2026-04-16',
      'project: smoke',
      'project_key: NOKEY',
      'tracking_system: file-system',
      'story_location: _bmad-output/implementation-artifacts',
      'development_status:',
      '  epic-ex1: in-progress',
      `  ${storyKey}: ready-for-dev`,
      '  epic-ex1-retrospective: optional',
      '',
    ].join('\n'),
  );
}

describe('orchestrator real-run (EA13-S3 CI-sized replay)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'orch-real-run-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('flips sprint-status.yaml to done, writes JSONL log, exits 0', async () => {
    await seedSandbox(dir, 'EX1-S1');

    // Build a real runner on in-memory adapters — same topology as the
    // default factory, just with scripted turns instead of SDK-backed ones.
    const eventBus = new EventBus();
    const structuredLogger = new StructuredLogger(dir);
    const sessionLogger = new SessionLogger(structuredLogger, eventBus);
    const supervisorAdapter = new InMemorySupervisorAdapter(new Map());
    const supervisorService = new SupervisorService(supervisorAdapter, sessionLogger);
    const sessionPort = new InMemorySessionAdapter(
      // Enough turns for 3 commands × 1 turn each (create-story / dev-story / code-review)
      Array.from({ length: 3 }, () => ({ completed: true, output: 'ok', durationMs: 1 })),
    );
    const runner = createDefaultBMADCommandRunner({ sessionPort, supervisorService });

    const origExitCode = process.exitCode;
    process.exitCode = 0;

    try {
      await orchestratorRunCommand({ epic: 'EX1', projectRoot: dir }, { runner });
      expect(process.exitCode).toBe(0);

      // Sprint status flipped
      const statusYaml = await readFile(
        join(dir, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml'),
        'utf-8',
      );
      expect(statusYaml).toContain('EX1-S1: done');

      // JSONL sprint log exists and has ≥1 entry per command fired
      const today = new Date().toISOString().slice(0, 10);
      const logPath = join(dir, '.cop1', `sprint-log-${today}.jsonl`);
      const logRaw = await readFile(logPath, 'utf-8');
      const logLines = logRaw.trim().split('\n').filter(Boolean);
      expect(logLines.length).toBeGreaterThanOrEqual(1);
      const parsed = logLines.map((l) => JSON.parse(l));
      expect(parsed[0]).toHaveProperty('event', 'auto-decision');
      // At least one entry must carry a command — proves the runner actually
      // routed through, not just returned canned responses.
      expect(parsed.some((p) => typeof p.command === 'string' && p.command.length > 0)).toBe(
        true,
      );
    } finally {
      process.exitCode = origExitCode;
    }
  });

  it('multi-story epic: all stories end in done state', async () => {
    const artifacts = join(dir, '_bmad-output', 'implementation-artifacts');
    await mkdir(artifacts, { recursive: true });
    await writeFile(
      join(dir, 'supervisor-playbook.md'),
      '## Mission\nmulti\n## Development Loop\ncycle.\n## Escalation Policy\nescalate.\n',
    );
    await writeFile(
      join(artifacts, 'sprint-status.yaml'),
      [
        'development_status:',
        '  epic-ex2: in-progress',
        '  EX2-S1: ready-for-dev',
        '  EX2-S2: ready-for-dev',
        '',
      ].join('\n'),
    );

    const eventBus = new EventBus();
    const sessionLogger = new SessionLogger(new StructuredLogger(dir), eventBus);
    const supervisorService = new SupervisorService(
      new InMemorySupervisorAdapter(new Map()),
      sessionLogger,
    );
    const sessionPort = new InMemorySessionAdapter(
      Array.from({ length: 6 }, () => ({ completed: true, output: 'ok', durationMs: 1 })),
    );
    const runner = createDefaultBMADCommandRunner({ sessionPort, supervisorService });

    const origExitCode = process.exitCode;
    process.exitCode = 0;

    try {
      await orchestratorRunCommand({ epic: 'EX2', projectRoot: dir }, { runner });
      expect(process.exitCode).toBe(0);
      const statusYaml = await readFile(join(artifacts, 'sprint-status.yaml'), 'utf-8');
      expect(statusYaml).toContain('EX2-S1: done');
      expect(statusYaml).toContain('EX2-S2: done');
    } finally {
      process.exitCode = origExitCode;
    }
  });
});
