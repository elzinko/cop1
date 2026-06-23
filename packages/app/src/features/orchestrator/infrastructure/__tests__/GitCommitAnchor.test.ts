import { describe, expect, it } from 'vitest';
import { GitCommitAnchor, type GitResult, type GitRunner } from '../GitCommitAnchor.js';

const ok = (stdout = ''): GitResult => ({ code: 0, stdout, stderr: '' });
const fail = (stderr = ''): GitResult => ({ code: 1, stdout: '', stderr });

function runner(script: (args: string[]) => GitResult): GitRunner {
  return async (_root, args) => script(args);
}

describe('GitCommitAnchor', () => {
  it('stages, commits, and returns the short SHA', async () => {
    const calls: string[][] = [];
    const anchor = new GitCommitAnchor(
      runner((args) => {
        calls.push(args);
        if (args[0] === 'add') return ok();
        if (args[0] === 'diff') return fail(); // non-zero ⇒ staged changes present
        if (args[0] === 'commit') return ok();
        if (args[0] === 'rev-parse') return ok('abc1234\n');
        return fail();
      }),
    );

    const sha = await anchor.commit('/repo', 'anchor msg');

    expect(sha).toBe('abc1234');
    expect(calls[0]).toEqual(['add', '-A']);
    expect(calls.some((a) => a[0] === 'commit' && a.includes('anchor msg'))).toBe(true);
  });

  it('returns null when there is nothing to commit (clean index)', async () => {
    const anchor = new GitCommitAnchor(
      runner((args) => {
        if (args[0] === 'add') return ok();
        if (args[0] === 'diff') return ok(); // exit 0 ⇒ nothing staged
        return fail();
      }),
    );
    expect(await anchor.commit('/repo', 'msg')).toBeNull();
  });

  it('returns null when staging fails (best-effort, never throws)', async () => {
    const anchor = new GitCommitAnchor(runner(() => fail('boom')));
    expect(await anchor.commit('/repo', 'msg')).toBeNull();
  });

  it('returns null when the commit step fails', async () => {
    const anchor = new GitCommitAnchor(
      runner((args) => {
        if (args[0] === 'add') return ok();
        if (args[0] === 'diff') return fail(); // staged changes present
        if (args[0] === 'commit') return fail('hook rejected');
        return fail();
      }),
    );
    expect(await anchor.commit('/repo', 'msg')).toBeNull();
  });
});
