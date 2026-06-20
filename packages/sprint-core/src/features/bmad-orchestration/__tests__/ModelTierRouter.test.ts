import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODEL_TIER_CONFIG,
  DefaultModelTierRouter,
  type ModelTierRouterConfig,
} from '../domain/ModelTierRouter.js';

describe('DefaultModelTierRouter', () => {
  const router = new DefaultModelTierRouter();

  it('routes create-story to the strong tier (opus)', () => {
    expect(router.resolve('/bmad-bmm-create-story')).toBe('opus');
  });

  it('routes code-review to the strong tier (opus)', () => {
    expect(router.resolve('/bmad-bmm-code-review')).toBe('opus');
  });

  it('routes dev-story to the cheaper tier (sonnet)', () => {
    expect(router.resolve('/bmad-bmm-dev-story')).toBe('sonnet');
  });

  it('routes qa-automate to the cheaper tier (sonnet)', () => {
    expect(router.resolve('/bmad-bmm-qa-automate')).toBe('sonnet');
  });

  it('falls back to the cheaper tier for unknown commands', () => {
    expect(router.resolve('/some-unknown-command')).toBe('sonnet');
  });

  it('exposes a cost-aware default config (fallback = sonnet, with rules)', () => {
    expect(DEFAULT_MODEL_TIER_CONFIG.fallback).toBe('sonnet');
    expect(DEFAULT_MODEL_TIER_CONFIG.rules.length).toBeGreaterThan(0);
  });

  it('honours a custom configuration (first matching rule wins)', () => {
    const config: ModelTierRouterConfig = {
      rules: [
        { match: 'dev-story', tier: 'haiku' },
        { match: 'story', tier: 'opus' },
      ],
      fallback: 'sonnet',
    };
    const custom = new DefaultModelTierRouter(config);
    expect(custom.resolve('/bmad-bmm-dev-story')).toBe('haiku'); // first rule wins
    expect(custom.resolve('/bmad-bmm-create-story')).toBe('opus');
    expect(custom.resolve('/bmad-bmm-code-review')).toBe('sonnet'); // fallback
  });
});
