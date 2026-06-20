import { afterEach, describe, expect, it } from 'vitest';
import { parseEnvInt, parseEnvMinToMs } from '../../../cli/commands/orchestrator.js';

const KEY = 'COP1_TEST_ENV_PARSE';

describe('parseEnvInt / parseEnvMinToMs', () => {
  afterEach(() => {
    delete process.env[KEY];
  });

  it('returns undefined when absent', () => {
    expect(parseEnvInt(KEY)).toBeUndefined();
  });

  it('returns the strictly-positive integer', () => {
    process.env[KEY] = '5000';
    expect(parseEnvInt(KEY)).toBe(5000);
  });

  it('returns undefined for zero (no cap, not a 0 cap)', () => {
    process.env[KEY] = '0';
    expect(parseEnvInt(KEY)).toBeUndefined();
  });

  it('returns undefined for a negative value', () => {
    process.env[KEY] = '-100';
    expect(parseEnvInt(KEY)).toBeUndefined();
  });

  it('returns undefined for non-numeric input', () => {
    process.env[KEY] = 'abc';
    expect(parseEnvInt(KEY)).toBeUndefined();
  });

  it('converts positive minutes to milliseconds', () => {
    process.env[KEY] = '2';
    expect(parseEnvMinToMs(KEY)).toBe(120_000);
  });

  it('returns undefined for zero minutes', () => {
    process.env[KEY] = '0';
    expect(parseEnvMinToMs(KEY)).toBeUndefined();
  });
});
