import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInterCommandApprovalResolver } from '../infrastructure/InterCommandApprovalResolver.js';

describe('createInterCommandApprovalResolver', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'approval-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reads `y` token from approvalFile and returns continue', async () => {
    const path = join(dir, 'approval');
    await writeFile(path, 'y\n');
    const resolver = createInterCommandApprovalResolver({
      approvalFile: path,
      isTTY: false,
      sleep: async () => {},
    });
    const result = await resolver({ phase: 'inter' });
    expect(result).toBe('continue');
  });

  it('reads `abort` token and returns abort', async () => {
    const path = join(dir, 'approval');
    await writeFile(path, 'abort');
    const resolver = createInterCommandApprovalResolver({
      approvalFile: path,
      isTTY: false,
      sleep: async () => {},
    });
    expect(await resolver({ phase: 'inter' })).toBe('abort');
  });

  it('reads `skip` token and returns skip', async () => {
    const path = join(dir, 'approval');
    await writeFile(path, 'n');
    const resolver = createInterCommandApprovalResolver({
      approvalFile: path,
      isTTY: false,
      sleep: async () => {},
    });
    expect(await resolver({ phase: 'inter' })).toBe('skip');
  });

  it('returns continue when no approvalFile and no TTY (CI default)', async () => {
    const resolver = createInterCommandApprovalResolver({ isTTY: false });
    expect(await resolver({ phase: 'inter' })).toBe('continue');
  });
});
