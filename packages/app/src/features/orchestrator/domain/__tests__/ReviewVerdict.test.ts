import { describe, expect, it } from 'vitest';
import { classifyReviewVerdict, isReviewCommand } from '../ReviewVerdict.js';

describe('classifyReviewVerdict', () => {
  it('returns unknown for empty / ambiguous prose (advances by default)', () => {
    expect(classifyReviewVerdict('')).toBe('unknown');
    expect(classifyReviewVerdict('I reviewed the code and looked at the tests.')).toBe('unknown');
  });

  describe('explicit blocking verdicts → changes-requested', () => {
    it.each([
      'Verdict: FAIL',
      'verdict = blocked',
      'Verdict: changes-requested',
      'Changes requested before merge.',
      'I am requesting changes on this PR.',
      'The feature is not implemented.',
      '❌ Several acceptance criteria are unmet.',
      'Verdict : bloquant',
      'Des modifications demandées avant merge.',
      'La story est non implémentée.',
    ])('%s', (text) => {
      expect(classifyReviewVerdict(text)).toBe('changes-requested');
    });
  });

  describe('explicit approvals → approved', () => {
    it.each([
      'Verdict: PASS',
      'Verdict = approved',
      'LGTM 🚀',
      '✅ All acceptance criteria met.',
      'Verdict : validé',
      'Code approuvé, rien à signaler.',
    ])('%s', (text) => {
      expect(classifyReviewVerdict(text)).toBe('approved');
    });
  });

  it('blocking wins when both signals appear (safety: explicit rejection dominates)', () => {
    expect(
      classifyReviewVerdict('Looks approved overall, but changes requested on error handling.'),
    ).toBe('changes-requested');
  });

  it('does not block a positive review that merely mentions tests passing', () => {
    expect(
      classifyReviewVerdict('All tests pass and there are no blockers. Nice work — looks good.'),
    ).toBe('unknown');
  });
});

describe('isReviewCommand', () => {
  it('matches the code-review command only', () => {
    expect(isReviewCommand('/bmad-bmm-code-review')).toBe(true);
    expect(isReviewCommand('/bmad-bmm-dev-story')).toBe(false);
    expect(isReviewCommand('/bmad-bmm-create-story')).toBe(false);
  });
});
