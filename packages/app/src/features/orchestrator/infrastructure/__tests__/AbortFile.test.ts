import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAbortFilePredicate } from '../AbortFile.js';

describe('createAbortFilePredicate', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'abort-file-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns false when the abort file is absent', () => {
    const predicate = createAbortFilePredicate(join(dir, 'abort'));
    expect(predicate()).toBe(false);
  });

  it('returns true once the abort file exists', async () => {
    const path = join(dir, 'abort');
    const predicate = createAbortFilePredicate(path);
    expect(predicate()).toBe(false);
    await writeFile(path, '');
    expect(predicate()).toBe(true);
  });
});
