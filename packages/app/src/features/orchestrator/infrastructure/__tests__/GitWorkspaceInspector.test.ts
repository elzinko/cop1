import { describe, expect, it } from 'vitest';
import { GitWorkspaceInspector, parsePorcelainPaths } from '../GitWorkspaceInspector.js';

describe('parsePorcelainPaths', () => {
  it('parses modified, added and untracked entries', () => {
    const porcelain = [
      ' M src/app.js',
      'A  src/new.ts',
      '?? src/untracked.css',
      ' M _bmad-output/implementation-artifacts/FEAT-S1.md',
    ].join('\n');
    expect(parsePorcelainPaths(porcelain)).toEqual([
      'src/app.js',
      'src/new.ts',
      'src/untracked.css',
      '_bmad-output/implementation-artifacts/FEAT-S1.md',
    ]);
  });

  it('uses the destination path for renames', () => {
    expect(parsePorcelainPaths('R  src/old.ts -> src/renamed.ts')).toEqual(['src/renamed.ts']);
  });

  it('unquotes quoted paths', () => {
    expect(parsePorcelainPaths('?? "src/with space.js"')).toEqual(['src/with space.js']);
  });

  it('returns an empty array for a clean tree', () => {
    expect(parsePorcelainPaths('')).toEqual([]);
    expect(parsePorcelainPaths('\n\n')).toEqual([]);
  });
});

describe('GitWorkspaceInspector', () => {
  it('returns parsed paths from the injected git runner, scoped to the root', async () => {
    const seen: string[] = [];
    const inspector = new GitWorkspaceInspector(async (root) => {
      seen.push(root);
      return ' M src/app.js\n?? src/new.css\n';
    });
    const paths = await inspector.changedPaths('/tmp/project');
    expect(seen).toEqual(['/tmp/project']);
    expect(paths).toEqual(['src/app.js', 'src/new.css']);
  });

  it('returns an empty array when the tree is clean', async () => {
    const inspector = new GitWorkspaceInspector(async () => '');
    expect(await inspector.changedPaths('/tmp/project')).toEqual([]);
  });
});
