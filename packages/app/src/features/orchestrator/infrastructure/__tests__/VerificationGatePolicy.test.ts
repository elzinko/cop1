import { describe, expect, it } from 'vitest';
import { shouldVerify } from '../../domain/VerificationGate.js';

describe('shouldVerify', () => {
  it('verifies dev-story (code-producing)', () => {
    expect(shouldVerify('/bmad-bmm-dev-story')).toBe(true);
  });

  it('does not verify create-story (no code produced)', () => {
    expect(shouldVerify('/bmad-bmm-create-story')).toBe(false);
  });

  it('does not verify code-review (no code produced)', () => {
    expect(shouldVerify('/bmad-bmm-code-review')).toBe(false);
  });
});
