import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SupervisorPlaybookLoader } from '../application/SupervisorPlaybookLoader.js';

const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..', '..', '..');

describe('project supervisor-playbook.md (EA10-S3)', () => {
  it('parses and validates through the real .claude/commands directory', async () => {
    const loader = new SupervisorPlaybookLoader({ projectRoot: PROJECT_ROOT });
    const pb = await loader.load(join(PROJECT_ROOT, 'supervisor-playbook.md'));
    expect(pb.phases.length).toBeGreaterThanOrEqual(2);
    const commands = pb.phases.flatMap((p) => p.commands.map((c) => c.command));
    expect(commands).toContain('/bmad-bmm-create-story');
    expect(commands).toContain('/bmad-bmm-dev-story');
    expect(commands).toContain('/bmad-bmm-code-review');
    expect(pb.version).toContain('6.0.0');
    expect(pb.hooks.worktree).toBeTruthy();
    expect(pb.decisionPolicy).toContain('cascade');
  });
});
