import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SupervisorContext, SupervisorProjectMetadata } from '../domain/SupervisorContext.js';

export interface SupervisorContextLoaderOptions {
  /**
   * Injectable warn sink for missing-file notices. Defaults to console.warn.
   */
  warn?: (message: string) => void;
  /**
   * Override for planning-artifacts folder. Defaults to
   * `_bmad-output/planning-artifacts` relative to projectRoot.
   * Typically set from `_bmad/bmm/config.yaml` when available.
   */
  planningArtifactsDir?: string;
}

/**
 * Loads the supervisor session bootstrap context from the project filesystem.
 *
 * Reads PRD (`planning-artifacts/prd.md`), architecture
 * (`planning-artifacts/architecture.md`), and minimal project metadata
 * (`package.json`) into a `SupervisorContext`. Missing files are non-fatal —
 * the corresponding field becomes an empty string and a warning is logged.
 *
 * Introduced by EA11-S6. Co-located with `SupervisorService` in
 * `bmad-orchestration/` per validation report Option A.
 *
 * Note: content is returned verbatim without truncation. Callers (EA10) decide
 * trimming against the long-running session budget (ADR-014 §3.3).
 */
export class SupervisorContextLoader {
  private readonly warn: (message: string) => void;

  constructor(private readonly options: SupervisorContextLoaderOptions = {}) {
    this.warn = options.warn ?? ((msg) => console.warn(msg));
  }

  async load(projectRoot: string): Promise<SupervisorContext> {
    const planningDir =
      this.options.planningArtifactsDir ?? join(projectRoot, '_bmad-output', 'planning-artifacts');

    const [prd, architecture, projectMetadata] = await Promise.all([
      this.readOptional(join(planningDir, 'prd.md'), 'PRD'),
      this.readOptional(join(planningDir, 'architecture.md'), 'architecture'),
      this.readProjectMetadata(projectRoot),
    ]);

    return {
      prd,
      architecture,
      projectMetadata,
      iamthelaw: '', // TODO EA7 — iamthelaw module integration
      loadedAt: new Date().toISOString(),
    };
  }

  private async readOptional(path: string, label: string): Promise<string> {
    try {
      return await readFile(path, 'utf-8');
    } catch {
      this.warn(`[SupervisorContextLoader] ${label} not found at ${path} — field will be empty`);
      return '';
    }
  }

  private async readProjectMetadata(projectRoot: string): Promise<SupervisorProjectMetadata> {
    const fallback: SupervisorProjectMetadata = {
      name: 'unknown',
      version: '0.0.0',
      packageManager: 'npm',
      rootPath: projectRoot,
    };
    try {
      const raw = await readFile(join(projectRoot, 'package.json'), 'utf-8');
      const pkg = JSON.parse(raw) as {
        name?: string;
        version?: string;
        packageManager?: string;
      };
      return {
        name: pkg.name ?? fallback.name,
        version: pkg.version ?? fallback.version,
        packageManager: this.detectPackageManager(pkg.packageManager),
        rootPath: projectRoot,
      };
    } catch {
      this.warn(
        `[SupervisorContextLoader] package.json not readable at ${projectRoot} — using defaults`,
      );
      return fallback;
    }
  }

  private detectPackageManager(raw: string | undefined): string {
    if (!raw) return 'npm';
    const match = raw.match(/^([^@]+)@/);
    return match?.[1] ?? raw;
  }
}
