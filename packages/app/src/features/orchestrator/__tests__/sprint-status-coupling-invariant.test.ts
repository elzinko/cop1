import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * EA12-S4 / AC2 — file-level coupling invariant.
 *
 * After the A6 pivot, the literal string `sprint-status.yaml` must appear in
 * at most a small, explicit allowlist of runtime files. The target
 * architecture (V1.1 follow-up) replaces all remaining references with
 * `/bmad-bmm-sprint-status` workflow invocation via
 * `BmadCommandStatusAdapter`.
 */

const PKG_ROOT = join(__dirname, '..', '..', '..', '..', '..', '..', 'packages');

const ALLOWLIST_SUFFIXES = [
  // Single localized YAML adapter — the BMAD file coupling lives here only.
  'app/src/features/orchestrator/infrastructure/YamlSprintStatusAdapter.ts',
  // Orchestrator reads the YAML to enumerate stories — documented in the file
  // header; planned to migrate to BmadCommandStatusAdapter in V1.1.
  'app/src/features/orchestrator/application/OrchestratorService.ts',
  // Invariant test self-references the filename — meta reference.
  'app/src/features/orchestrator/__tests__/sprint-status-coupling-invariant.test.ts',
  // BMADReader scans `_bmad-output/implementation-artifacts/` which includes
  // sprint-status.yaml among story markdown files. Planned migration: gate
  // listStories through SprintStatusPort in V1.1.
  'sprint-core/src/features/bmad-reader/application/BMADReader.ts',
  // YamlStatusStore writes to `.cop1/sprint-status.yaml` (cop1-owned legacy
  // file, distinct from BMAD's `_bmad-output/.../sprint-status.yaml`). The
  // string match is coincidental; rename deferred to avoid breaking existing
  // installs.
  'sprint-core/src/features/story-tracker/infrastructure/YamlStatusStore.ts',
];

async function walk(dir: string, acc: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'coverage') continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) await walk(full, acc);
    else if (e.isFile() && extname(e.name) === '.ts') acc.push(full);
  }
  return acc;
}

describe('sprint-status.yaml coupling invariant (EA12-S4)', () => {
  it('limits file-level references to the explicit allowlist', async () => {
    const files = await walk(PKG_ROOT);
    const offenders: string[] = [];
    for (const file of files) {
      const relFromPackages = relative(PKG_ROOT, file).split(sep).join('/');
      // Skip test files — they may seed YAML fixtures.
      if (relFromPackages.includes('/__tests__/') || relFromPackages.endsWith('.test.ts')) {
        if (!relFromPackages.endsWith('sprint-status-coupling-invariant.test.ts')) continue;
      }
      const content = await readFile(file, 'utf-8');
      if (!content.includes('sprint-status.yaml')) continue;
      if (ALLOWLIST_SUFFIXES.some((s) => relFromPackages.endsWith(s))) continue;
      offenders.push(relFromPackages);
    }
    expect(offenders, `Unexpected sprint-status.yaml references: ${offenders.join(', ')}`).toEqual(
      [],
    );
  });
});
