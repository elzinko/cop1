import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { orchestratorRunCommand } from '../orchestrator.js';

async function seedFixture(dir: string): Promise<void> {
  const cmds = join(dir, '.claude', 'commands');
  await mkdir(cmds, { recursive: true });
  for (const name of ['bmad-bmm-create-story', 'bmad-bmm-dev-story', 'bmad-bmm-code-review']) {
    await writeFile(join(cmds, `${name}.md`), '---\n');
  }
  await writeFile(
    join(dir, 'supervisor-playbook.md'),
    ['BMAD version: 6.0.0', 'help: /bmad-help', '', '## Loop', '1. `/bmad-bmm-dev-story`'].join(
      '\n',
    ),
  );
  const artifacts = join(dir, '_bmad-output', 'implementation-artifacts');
  await mkdir(artifacts, { recursive: true });
  await writeFile(
    join(artifacts, 'sprint-status.yaml'),
    ['development_status:', '  epic-ea99: in-progress', '  EA99-S1: ready-for-dev', ''].join('\n'),
  );
}

describe('orchestratorRunCommand', () => {
  let dir: string;
  let origExitCode: number | string | null | undefined;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'orch-cli-'));
    origExitCode = process.exitCode;
    process.exitCode = 0;
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    process.exitCode = origExitCode;
  });

  it('exits with code 1 when --epic missing', async () => {
    // @ts-expect-error — intentional: exercise missing-flag branch
    await orchestratorRunCommand({});
    expect(process.exitCode).toBe(1);
  });

  it('runs happy path end-to-end with a stub runner', async () => {
    await seedFixture(dir);
    const runner = vi.fn(async () => ({ success: true, nextStatus: 'done' as const }));
    await orchestratorRunCommand({ epic: 'EA99', projectRoot: dir }, { runner });
    expect(runner).toHaveBeenCalled();
    const log = await readFile(
      join(dir, '.cop1', `sprint-log-${new Date().toISOString().slice(0, 10)}.jsonl`),
      'utf-8',
    );
    expect(log).toContain('"event":"auto-decision"');
    expect(process.exitCode).toBe(0);
  });

  it('exits with 1 when playbook missing', async () => {
    const artifacts = join(dir, '_bmad-output', 'implementation-artifacts');
    await mkdir(artifacts, { recursive: true });
    await writeFile(join(artifacts, 'sprint-status.yaml'), 'development_status: {}\n');
    await orchestratorRunCommand({ epic: 'EA99', projectRoot: dir });
    expect(process.exitCode).toBe(1);
  });
});
