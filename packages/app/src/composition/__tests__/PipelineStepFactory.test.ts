import type { Cop1Config } from '@cop1/shared-kernel';
import { EventBus } from '@cop1/shared-kernel';
import {
  type BMADSessionPort,
  InMemorySessionAdapter,
  InMemorySupervisorAdapter,
  SessionLogger,
  SupervisorService,
  type WorkflowStep,
} from '@cop1/sprint-core';
import { describe, expect, it } from 'vitest';
import type { ConfigLoader } from '../../features/config/application/ConfigLoader.js';
import { PipelineStepFactory } from '../PipelineStepFactory.js';

function createConfig(useBMAD: boolean): Cop1Config {
  return {
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
    workflow: { useBMAD },
    blocage_rules: {},
    schedule: { auto_start: [] },
    budget: { sprint_max_tokens: 0, alert_thresholds: [], auto_pause: false },
  };
}

function createMockConfigLoader(config: Cop1Config): ConfigLoader {
  return { get: () => config } as unknown as ConfigLoader;
}

function createSupervisorService(): SupervisorService {
  const supervisorAdapter = new InMemorySupervisorAdapter(new Map());
  // Stub structured logger — only needs `event(type, payload)`.
  const stubStructuredLogger = { event: () => {} } as unknown as ConstructorParameters<
    typeof SessionLogger
  >[0];
  const sessionLogger = new SessionLogger(stubStructuredLogger);
  return new SupervisorService(supervisorAdapter, sessionLogger);
}

function createSessionPort(): BMADSessionPort {
  return new InMemorySessionAdapter([
    { completed: true, output: 'ok', durationMs: 1 },
  ]);
}

describe('PipelineStepFactory', () => {
  it('should return three BMADSessionStep instances when useBMAD is true', () => {
    const eventBus = new EventBus();
    const sessionPort = createSessionPort();
    const supervisorService = createSupervisorService();
    const factory = new PipelineStepFactory(eventBus, { sessionPort, supervisorService });

    const steps = factory.build(createConfig(true));

    expect(steps).toHaveLength(3);
    expect(steps.map((s: WorkflowStep) => s.name)).toEqual([
      'bmad-dev',
      'bmad-review',
      'bmad-qa',
    ]);
  });

  it('should return legacy steps when useBMAD is false', () => {
    const eventBus = new EventBus();
    const factory = new PipelineStepFactory(eventBus);
    const config = createConfig(false);
    const configLoader = createMockConfigLoader(config);

    const steps = factory.build(config, configLoader);

    expect(steps).toHaveLength(4);
    expect(steps.map((s: WorkflowStep) => s.name)).toEqual(['dev', 'reviewer', 'qa', 'pm']);
  });

  it('should throw when useBMAD is false but no configLoader provided', () => {
    const eventBus = new EventBus();
    const factory = new PipelineStepFactory(eventBus);

    expect(() => factory.build(createConfig(false))).toThrow(
      'ConfigLoader is required for legacy pipeline',
    );
  });

  it('should throw when useBMAD is true but sessionPort/supervisorService missing', () => {
    const eventBus = new EventBus();
    const factory = new PipelineStepFactory(eventBus);

    expect(() => factory.build(createConfig(true))).toThrow(
      'BMADSessionPort and SupervisorService are required when workflow.useBMAD is true',
    );
  });

  it('should throw when only sessionPort is provided (missing supervisorService)', () => {
    const eventBus = new EventBus();
    const factory = new PipelineStepFactory(eventBus, { sessionPort: createSessionPort() });

    expect(() => factory.build(createConfig(true))).toThrow(
      'BMADSessionPort and SupervisorService are required when workflow.useBMAD is true',
    );
  });
});
