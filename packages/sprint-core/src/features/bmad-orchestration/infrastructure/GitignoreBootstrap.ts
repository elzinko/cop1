import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const MANAGED_PATHS = ['.cop1/metrics/'];
const MANAGED_COMMENT =
  '# cop1 — managed by EA11-S8 (.cop1/metrics is local JSONL, never committed)';

/**
 * Ensures `.cop1/metrics/` is gitignored. Idempotent and gated by a
 * `--yes` / programmatic flag so cop1 never silently mutates the user's
 * repository on first run (ADR-014 §8.6).
 */
export class GitignoreBootstrap {
  constructor(private readonly projectRoot: string) {}

  /**
   * Ensure managed entries are present. When `consent=true`, writes the entries
   * if missing; otherwise returns `{ wouldUpdate: true }` so the caller can
   * prompt the user.
   */
  async ensure(consent: boolean): Promise<{ updated: boolean; wouldUpdate: boolean }> {
    const path = join(this.projectRoot, '.gitignore');
    let current = '';
    try {
      current = await readFile(path, 'utf-8');
    } catch {
      current = '';
    }

    const missingPaths = MANAGED_PATHS.filter((p) => !current.includes(p));
    if (missingPaths.length === 0) {
      return { updated: false, wouldUpdate: false };
    }
    if (!consent) {
      return { updated: false, wouldUpdate: true };
    }

    const tail = current.length > 0 && !current.endsWith('\n') ? '\n' : '';
    const commentLine = current.includes(MANAGED_COMMENT) ? '' : `${MANAGED_COMMENT}\n`;
    const next = `${current}${tail}\n${commentLine}${missingPaths.join('\n')}\n`;
    await writeFile(path, next, 'utf-8');
    return { updated: true, wouldUpdate: false };
  }
}
