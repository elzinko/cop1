import { existsSync } from 'node:fs';

/**
 * Builds an external-abort predicate backed by the presence of a file on disk.
 * Wired into `RunBudget` as its `externalAbort` source so an operator can stop
 * an unattended run by creating `.cop1/abort`. Checked lazily on each call so a
 * file created mid-run is picked up.
 */
export function createAbortFilePredicate(path: string): () => boolean {
  return () => existsSync(path);
}
