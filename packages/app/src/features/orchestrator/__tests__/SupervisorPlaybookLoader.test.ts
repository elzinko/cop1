import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SupervisorPlaybookLoader } from '../application/SupervisorPlaybookLoader.js';

async function makeProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'playbook-loader-'));
  const cmds = join(dir, '.claude', 'commands');
  await mkdir(cmds, { recursive: true });
  // Seed the known BMAD commands we reference in tests.
  for (const name of [
    'bmad-bmm-create-story',
    'bmad-bmm-dev-story',
    'bmad-bmm-code-review',
    'bmad-help',
  ]) {
    await writeFile(join(cmds, `${name}.md`), '---\nname: x\n---\n');
  }
  return dir;
}

describe('SupervisorPlaybookLoader', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await makeProject();
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('parses a minimal valid playbook (prose-only phase, post-EA12-S3 pivot)', async () => {
    const path = join(projectRoot, 'playbook.md');
    await writeFile(
      path,
      [
        'BMAD version: 6.0.0-Beta.8',
        'help: /bmad-help',
        '',
        '## Development Loop',
        '',
        'The supervisor drives the canonical scrum cycle.',
        '',
      ].join('\n'),
    );
    const loader = new SupervisorPlaybookLoader({ projectRoot });
    const pb = await loader.load(path);
    expect(pb.version).toBe('6.0.0-Beta.8');
    expect(pb.helpRef).toBe('/bmad-help');
    expect(pb.phases).toHaveLength(1);
    expect(pb.phases[0]?.name).toBe('Development Loop');
    expect(pb.phases[0]?.commands).toBeUndefined();
    expect(pb.phases[0]?.intent).toContain('canonical scrum cycle');
  });

  it('still parses ordered-list commands for backwards-compat', async () => {
    const path = join(projectRoot, 'playbook.md');
    await writeFile(
      path,
      [
        'BMAD version: 6',
        'help: /bmad-help',
        '',
        '## Loop',
        '1. `/bmad-bmm-dev-story`',
        '2. `/bmad-bmm-code-review`',
      ].join('\n'),
    );
    const loader = new SupervisorPlaybookLoader({ projectRoot });
    const pb = await loader.load(path);
    expect(pb.phases[0]?.commands?.map((c) => c.command)).toEqual([
      '/bmad-bmm-dev-story',
      '/bmad-bmm-code-review',
    ]);
  });

  it('parses all optional sections', async () => {
    const path = join(projectRoot, 'playbook.md');
    await writeFile(
      path,
      [
        'BMAD version: 6.0.0',
        'help: /bmad-help',
        'Epic/story restrictions: one epic',
        'Worktree hooks: managed',
        'Step-by-step hooks: transition-level',
        'Decision policy: 3-tier cascade',
        '',
        '## Loop',
        '',
        'Intent prose here.',
      ].join('\n'),
    );
    const loader = new SupervisorPlaybookLoader({ projectRoot });
    const pb = await loader.load(path);
    expect(pb.epicRestrictions?.raw).toContain('one epic');
    expect(pb.hooks.worktree).toContain('managed');
    expect(pb.hooks.stepByStep).toContain('transition-level');
    expect(pb.decisionPolicy).toContain('3-tier cascade');
  });

  it('throws on playbook missing H2 phases', async () => {
    const path = join(projectRoot, 'playbook.md');
    await writeFile(path, 'BMAD version: 6\nhelp: /bmad-help\n');
    const loader = new SupervisorPlaybookLoader({ projectRoot });
    await expect(loader.load(path)).rejects.toThrow('no H2 phases');
  });

  it('tolerates a phase with no ordered list (post-EA12-S3 pivot)', async () => {
    const path = join(projectRoot, 'playbook.md');
    await writeFile(path, 'BMAD version: 6\nhelp: /bmad-help\n\n## Prose Phase\n\nSome text.\n');
    const loader = new SupervisorPlaybookLoader({ projectRoot });
    const pb = await loader.load(path);
    expect(pb.phases).toHaveLength(1);
    expect(pb.phases[0]?.commands).toBeUndefined();
    expect(pb.phases[0]?.intent).toBe('Some text.');
  });

  it('rejects forbidden "commands:" preamble key (EA12-S3 A5 pivot)', async () => {
    const path = join(projectRoot, 'playbook.md');
    await writeFile(
      path,
      [
        'BMAD version: 6',
        'help: /bmad-help',
        'commands: /bmad-bmm-dev-story',
        '',
        '## Loop',
        '',
        'prose',
      ].join('\n'),
    );
    const loader = new SupervisorPlaybookLoader({ projectRoot });
    await expect(loader.load(path)).rejects.toThrow(/preamble key "commands" is not allowed/);
  });

  it('rejects forbidden "allowed_commands:" preamble key (EA12-S3 A5 pivot)', async () => {
    const path = join(projectRoot, 'playbook.md');
    await writeFile(
      path,
      [
        'BMAD version: 6',
        'help: /bmad-help',
        'allowed_commands: /bmad-bmm-dev-story',
        '',
        '## Loop',
        '',
        'prose',
      ].join('\n'),
    );
    const loader = new SupervisorPlaybookLoader({ projectRoot });
    await expect(loader.load(path)).rejects.toThrow(
      /preamble key "allowed_commands" is not allowed/,
    );
  });

  it('throws on unknown BMAD command', async () => {
    const path = join(projectRoot, 'playbook.md');
    await writeFile(
      path,
      ['BMAD version: 6', 'help: /bmad-help', '', '## Loop', '1. `/bmad-bmm-unknown-command`'].join(
        '\n',
      ),
    );
    const loader = new SupervisorPlaybookLoader({ projectRoot });
    await expect(loader.load(path)).rejects.toThrow(/Unknown BMAD command/);
  });

  it('parses budgets section (EA12-S5: max_tokens_per_night + max_reentrance_depth)', async () => {
    const path = join(projectRoot, 'playbook.md');
    await writeFile(
      path,
      [
        'BMAD version: 6',
        'help: /bmad-help',
        'max_tokens_per_night: 2_000_000',
        'max_reentrance_depth: 5',
        '',
        '## Loop',
        '',
        'prose',
      ].join('\n'),
    );
    const loader = new SupervisorPlaybookLoader({ projectRoot });
    const pb = await loader.load(path);
    expect(pb.budgets).toEqual({
      max_tokens_per_night: 2_000_000,
      max_reentrance_depth: 5,
    });
  });

  it('budgets omitted when no budget lines present', async () => {
    const path = join(projectRoot, 'playbook.md');
    await writeFile(
      path,
      ['BMAD version: 6', 'help: /bmad-help', '', '## Loop', '', 'prose'].join('\n'),
    );
    const loader = new SupervisorPlaybookLoader({ projectRoot });
    const pb = await loader.load(path);
    expect(pb.budgets).toBeUndefined();
  });

  it('supports multiple phases in order', async () => {
    const path = join(projectRoot, 'playbook.md');
    await writeFile(
      path,
      [
        'BMAD version: 6',
        'help: /bmad-help',
        '',
        '## Phase 1',
        '',
        'first phase prose',
        '',
        '## Phase 2',
        '',
        'second phase prose',
      ].join('\n'),
    );
    const loader = new SupervisorPlaybookLoader({ projectRoot });
    const pb = await loader.load(path);
    expect(pb.phases.map((p) => p.name)).toEqual(['Phase 1', 'Phase 2']);
  });
});
