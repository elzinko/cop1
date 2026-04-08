import type { ConfigPort, Cop1Config } from '@cop1/shared-kernel';
import { describe, expect, it } from 'vitest';
import { LLMRouter } from '../application/LLMRouter.js';

function createMockConfigPort(overrides: Partial<Cop1Config> = {}): ConfigPort {
  const defaultConfig: Cop1Config = {
    project: { name: 'test', path: '.' },
    daemon: { port: 4242 },
    sprint: { default_duration_hours: 8 },
    resources: {
      ram_budget_night_gb: 48,
      ram_budget_day_gb: 20,
      suspension_threshold_percent: 75,
      polling_interval_ms: 1000,
    },
    llm_routing: {},
    llm_fallback: {},
    git: { auto_merge: false },
    blocage_rules: {},
    schedule: { auto_start: [] },
    workflow: { useBMAD: true },
    budget: { sprint_max_tokens: 0, alert_thresholds: [], auto_pause: false },
    ...overrides,
  };
  return { get: () => defaultConfig };
}

describe('LLMRouter', () => {
  it('should route to the configured model for a command type', () => {
    const configPort = createMockConfigPort({
      llm_routing: { dev: 'mistral:7b', default: 'llama3:8b' },
    });
    const router = new LLMRouter(configPort);

    expect(router.route('dev')).toBe('mistral:7b');
  });

  it('should fallback to default when command type is not configured', () => {
    const configPort = createMockConfigPort({
      llm_routing: { dev: 'mistral:7b', default: 'llama3:8b' },
    });
    const router = new LLMRouter(configPort);

    expect(router.route('unknown')).toBe('llama3:8b');
  });

  it('should throw when no routing and no default configured', () => {
    const configPort = createMockConfigPort({ llm_routing: {} });
    const router = new LLMRouter(configPort);

    expect(() => router.route('dev')).toThrow('No LLM model configured');
  });

  it('should pick up config changes via ConfigPort (hot-reload)', () => {
    let routing = { dev: 'modelA', default: 'modelB' };
    const configPort: ConfigPort = {
      get: () => ({
        project: { name: 'test', path: '.' },
        daemon: { port: 4242 },
        sprint: { default_duration_hours: 8 },
        resources: {
          ram_budget_night_gb: 48,
          ram_budget_day_gb: 20,
          suspension_threshold_percent: 75,
          polling_interval_ms: 1000,
        },
        llm_routing: routing,
        llm_fallback: {},
        git: { auto_merge: false },
        blocage_rules: {},
        schedule: { auto_start: [] },
        workflow: { useBMAD: true },
        budget: { sprint_max_tokens: 0, alert_thresholds: [], auto_pause: false },
      }),
    };
    const router = new LLMRouter(configPort);

    expect(router.route('dev')).toBe('modelA');

    // Simulate hot-reload
    routing = { dev: 'modelC', default: 'modelD' };
    expect(router.route('dev')).toBe('modelC');
  });
});
