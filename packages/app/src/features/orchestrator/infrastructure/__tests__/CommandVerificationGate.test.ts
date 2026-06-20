import { describe, expect, it } from 'vitest';
import type { VerificationInput } from '../../domain/VerificationGate.js';
import { type CheckExecutor, CommandVerificationGate } from '../CommandVerificationGate.js';

const INPUT: VerificationInput = {
  projectRoot: '/p',
  command: '/bmad-bmm-dev-story',
  storyKey: 'S1',
};

function executor(codes: Record<string, number>): { exec: CheckExecutor; seen: string[] } {
  const seen: string[] = [];
  const exec: CheckExecutor = async (command) => {
    seen.push(command);
    return codes[command] ?? 0;
  };
  return { exec, seen };
}

describe('CommandVerificationGate', () => {
  it('passes when all checks exit 0', async () => {
    const { exec, seen } = executor({});
    const gate = new CommandVerificationGate({ checks: ['a', 'b'], executor: exec });
    const result = await gate.verify(INPUT);
    expect(result.passed).toBe(true);
    expect(seen).toEqual(['a', 'b']);
  });

  it('fails fast on the first non-zero check', async () => {
    const { exec, seen } = executor({ a: 2 });
    const gate = new CommandVerificationGate({ checks: ['a', 'b'], executor: exec });
    const result = await gate.verify(INPUT);
    expect(result.passed).toBe(false);
    expect(result.summary).toContain('a (exit 2)');
    expect(seen).toEqual(['a']); // 'b' not run — fail-fast
  });

  it('runs each check in the project root', async () => {
    let cwd = '';
    const gate = new CommandVerificationGate({
      checks: ['x'],
      executor: async (_command, dir) => {
        cwd = dir;
        return 0;
      },
    });
    await gate.verify({ ...INPUT, projectRoot: '/proj' });
    expect(cwd).toBe('/proj');
  });
});
