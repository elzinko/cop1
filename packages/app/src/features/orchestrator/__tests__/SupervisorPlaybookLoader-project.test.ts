import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SupervisorPlaybookLoader } from '../application/SupervisorPlaybookLoader.js';

const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..', '..', '..');

describe('project supervisor-playbook.md (EA10-S3 / EA12-S3 pivot)', () => {
  it('parses and validates through the real .claude/commands directory', async () => {
    const loader = new SupervisorPlaybookLoader({ projectRoot: PROJECT_ROOT });
    const pb = await loader.load(join(PROJECT_ROOT, 'supervisor-playbook.md'));
    expect(pb.phases.length).toBeGreaterThanOrEqual(2);
    // EA12-S3 pivot: the project playbook is intent-only. No phase enumerates
    // specific BMAD commands; the supervisor discovers them at runtime.
    for (const phase of pb.phases) {
      expect(phase.commands).toBeUndefined();
    }
    expect(pb.version).toContain('6.0.0');
    expect(pb.hooks.worktree).toBeTruthy();
    expect(pb.decisionPolicy).toContain('cascade');
  });
});
