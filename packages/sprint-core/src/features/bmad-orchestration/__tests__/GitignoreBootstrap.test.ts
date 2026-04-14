import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GitignoreBootstrap } from '../infrastructure/GitignoreBootstrap.js';

describe('GitignoreBootstrap', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'gitignore-bootstrap-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('adds managed entries when consent=true and entries missing', async () => {
    await writeFile(join(dir, '.gitignore'), 'node_modules\ndist\n');
    const boot = new GitignoreBootstrap(dir);
    const result = await boot.ensure(true);
    expect(result).toEqual({ updated: true, wouldUpdate: false });
    const content = await readFile(join(dir, '.gitignore'), 'utf-8');
    expect(content).toContain('.cop1/metrics/');
  });

  it('reports wouldUpdate when consent=false and entries missing', async () => {
    await writeFile(join(dir, '.gitignore'), '');
    const boot = new GitignoreBootstrap(dir);
    const result = await boot.ensure(false);
    expect(result).toEqual({ updated: false, wouldUpdate: true });
  });

  it('is idempotent when entries already present', async () => {
    await writeFile(join(dir, '.gitignore'), '.cop1/metrics/\n');
    const boot = new GitignoreBootstrap(dir);
    const result = await boot.ensure(true);
    expect(result).toEqual({ updated: false, wouldUpdate: false });
  });

  it('creates .gitignore when missing', async () => {
    const boot = new GitignoreBootstrap(dir);
    const result = await boot.ensure(true);
    expect(result.updated).toBe(true);
    const content = await readFile(join(dir, '.gitignore'), 'utf-8');
    expect(content).toContain('.cop1/metrics/');
  });
});
