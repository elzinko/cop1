import { describe, expect, it } from 'vitest';
import {
  hasImplementationChanges,
  isBookkeepingPath,
  shouldHaveCodeChanges,
} from '../WorkspaceChanges.js';

describe('WorkspaceChanges policy', () => {
  describe('isBookkeepingPath', () => {
    it('treats BMAD artefacts and cop1 run state as bookkeeping', () => {
      expect(isBookkeepingPath('_bmad-output/implementation-artifacts/FEAT-S1.md')).toBe(true);
      expect(isBookkeepingPath('_bmad-output/implementation-artifacts/sprint-status.yaml')).toBe(
        true,
      );
      expect(isBookkeepingPath('.cop1/sprint-log-2026-06-22.jsonl')).toBe(true);
      expect(isBookkeepingPath('.git/index')).toBe(true);
    });

    it('treats source files as implementation (not bookkeeping)', () => {
      expect(isBookkeepingPath('src/index.html')).toBe(false);
      expect(isBookkeepingPath('src/app.js')).toBe(false);
      expect(isBookkeepingPath('packages/app/src/foo.ts')).toBe(false);
    });

    it('unquotes git-quoted paths before matching', () => {
      expect(isBookkeepingPath('"_bmad-output/x.md"')).toBe(true);
    });
  });

  describe('hasImplementationChanges', () => {
    it('is false when only bookkeeping files changed (dev-story that only planned)', () => {
      expect(
        hasImplementationChanges([
          '_bmad-output/implementation-artifacts/FEAT-S1.md',
          '_bmad-output/implementation-artifacts/sprint-status.yaml',
          '.cop1/sprint-log-2026-06-22.jsonl',
        ]),
      ).toBe(false);
    });

    it('is true when at least one source file changed', () => {
      expect(
        hasImplementationChanges([
          '_bmad-output/implementation-artifacts/FEAT-S1.md',
          'src/app.js',
        ]),
      ).toBe(true);
    });

    it('is false for an empty change set', () => {
      expect(hasImplementationChanges([])).toBe(false);
    });
  });

  describe('shouldHaveCodeChanges', () => {
    it('requires code for dev-story', () => {
      expect(shouldHaveCodeChanges('/bmad-bmm-dev-story')).toBe(true);
    });
    it('does not require code for create-story or code-review', () => {
      expect(shouldHaveCodeChanges('/bmad-bmm-create-story')).toBe(false);
      expect(shouldHaveCodeChanges('/bmad-bmm-code-review')).toBe(false);
    });
  });
});
