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

  it('parses a minimal valid playbook', async () => {
    const path = join(projectRoot, 'playbook.md');
    await writeFile(
      path,
      [
        'BMAD version: 6.0.0-Beta.8',
        'help: /bmad-help',
        '',
        '## Development Loop',
        '1. `/bmad-bmm-dev-story`',
        '2. `/bmad-bmm-code-review`',
        '',
      ].join('\n'),
    );
    const loader = new SupervisorPlaybookLoader({ projectRoot });
    const pb = await loader.load(path);
    expect(pb.version).toBe('6.0.0-Beta.8');
    expect(pb.helpRef).toBe('/bmad-help');
    expect(pb.phases).toHaveLength(1);
    expect(pb.phases[0].commands.map((c) => c.command)).toEqual([
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
        '1. `/bmad-bmm-create-story`',
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

  it('throws on phase with no ordered list', async () => {
    const path = join(projectRoot, 'playbook.md');
    await writeFile(path, 'BMAD version: 6\nhelp: /bmad-help\n\n## Empty Phase\n\nSome text.\n');
    const loader = new SupervisorPlaybookLoader({ projectRoot });
    await expect(loader.load(path)).rejects.toThrow(
      'Phase "Empty Phase" has no ordered-list commands',
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

  it('supports multiple phases in order', async () => {
    const path = join(projectRoot, 'playbook.md');
    await writeFile(
      path,
      [
        'BMAD version: 6',
        'help: /bmad-help',
        '',
        '## Phase 1',
        '1. `/bmad-bmm-create-story`',
        '',
        '## Phase 2',
        '1. `/bmad-bmm-dev-story`',
      ].join('\n'),
    );
    const loader = new SupervisorPlaybookLoader({ projectRoot });
    const pb = await loader.load(path);
    expect(pb.phases.map((p) => p.name)).toEqual(['Phase 1', 'Phase 2']);
  });
});
