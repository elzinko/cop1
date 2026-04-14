import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupervisorContextLoader } from '../application/SupervisorContextLoader.js';

async function tempProject(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'sup-ctx-loader-'));
}

describe('SupervisorContextLoader', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await tempProject();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('loads PRD + architecture + package.json (happy path)', async () => {
    await mkdir(join(dir, '_bmad-output', 'planning-artifacts'), { recursive: true });
    await writeFile(join(dir, '_bmad-output', 'planning-artifacts', 'prd.md'), '# PRD body\n');
    await writeFile(
      join(dir, '_bmad-output', 'planning-artifacts', 'architecture.md'),
      '# Architecture body\n',
    );
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'cop1', version: '0.1.0', packageManager: 'pnpm@9.0.0' }),
    );

    const warn = vi.fn();
    const loader = new SupervisorContextLoader({ warn });
    const ctx = await loader.load(dir);

    expect(ctx.prd).toContain('PRD body');
    expect(ctx.architecture).toContain('Architecture body');
    expect(ctx.projectMetadata).toEqual({
      name: 'cop1',
      version: '0.1.0',
      packageManager: 'pnpm',
      rootPath: dir,
    });
    expect(ctx.iamthelaw).toBe('');
    expect(ctx.loadedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(warn).not.toHaveBeenCalled();
  });

  it('returns empty strings and warns when PRD missing', async () => {
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'x', version: '0.0.1' }));
    const warn = vi.fn();
    const loader = new SupervisorContextLoader({ warn });
    const ctx = await loader.load(dir);
    expect(ctx.prd).toBe('');
    expect(warn).toHaveBeenCalled();
  });

  it('returns empty architecture and warns when architecture missing', async () => {
    await mkdir(join(dir, '_bmad-output', 'planning-artifacts'), { recursive: true });
    await writeFile(join(dir, '_bmad-output', 'planning-artifacts', 'prd.md'), 'P');
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'x' }));
    const warn = vi.fn();
    const loader = new SupervisorContextLoader({ warn });
    const ctx = await loader.load(dir);
    expect(ctx.architecture).toBe('');
    expect(warn).toHaveBeenCalled();
  });

  it('uses fallback metadata when package.json missing', async () => {
    const warn = vi.fn();
    const loader = new SupervisorContextLoader({ warn });
    const ctx = await loader.load(dir);
    expect(ctx.projectMetadata.name).toBe('unknown');
    expect(ctx.projectMetadata.packageManager).toBe('npm');
  });

  it('honors planningArtifactsDir override', async () => {
    const customDir = join(dir, 'custom');
    await mkdir(customDir, { recursive: true });
    await writeFile(join(customDir, 'prd.md'), 'CUSTOM PRD');
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'x' }));

    const loader = new SupervisorContextLoader({
      planningArtifactsDir: customDir,
      warn: () => {},
    });
    const ctx = await loader.load(dir);
    expect(ctx.prd).toBe('CUSTOM PRD');
  });

  it('supports concurrent load calls without race', async () => {
    await mkdir(join(dir, '_bmad-output', 'planning-artifacts'), { recursive: true });
    await writeFile(join(dir, '_bmad-output', 'planning-artifacts', 'prd.md'), 'P');
    await writeFile(join(dir, '_bmad-output', 'planning-artifacts', 'architecture.md'), 'A');
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'z' }));

    const loader = new SupervisorContextLoader({ warn: () => {} });
    const [a, b, c] = await Promise.all([loader.load(dir), loader.load(dir), loader.load(dir)]);
    expect([a.prd, b.prd, c.prd]).toEqual(['P', 'P', 'P']);
  });
});
