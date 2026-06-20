import { describe, expect, it } from 'vitest';
import { isDestructiveBashCommand } from '../infrastructure/AgentSdkSessionAdapter.js';

describe('isDestructiveBashCommand', () => {
  it.each([
    'rm -rf /tmp/x',
    'rm -r build',
    'rm -fr node_modules',
    'cd app && rm -rf dist',
    'sudo rm -rf /tmp/x',
    'git reset --hard HEAD~1',
    'git clean -fdx',
  ])('flags destructive command: %s', (cmd) => {
    expect(isDestructiveBashCommand(cmd)).toBe(true);
  });

  it.each([
    'npm rm left-pad', // package-manager subcommand, not rm(1)
    'rm notes.txt', // single file, non-recursive
    'rm -f stale.lock', // force but non-recursive
    'pnpm install',
  ])('does not flag safe command: %s', (cmd) => {
    expect(isDestructiveBashCommand(cmd)).toBe(false);
  });
});
