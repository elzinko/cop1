import type { BMADCommandPort, BMADCommandResult, WorkflowStep } from '@cop1/sprint-core';
import type { Cop1Config } from '@cop1/shared-kernel';
import { EventBus } from '@cop1/shared-kernel';
import { describe, expect, it, vi } from 'vitest';
import { PipelineStepFactory } from '../PipelineStepFactory.js';
import type { ConfigLoader } from '../../features/config/application/ConfigLoader.js';

function createMockCommandPort(): BMADCommandPort {
  return {
    async execute(): Promise<BMADCommandResult> {
      return { success: true, output: 'mock', durationMs: 100 };
    },
  };
}

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
  };
}

function createMockConfigLoader(config: Cop1Config): ConfigLoader {
  return { get: () => config } as unknown as ConfigLoader;
}

describe('PipelineStepFactory', () => {
  it('should return BMAD steps when useBMAD is true', () => {
    const eventBus = new EventBus();
    const commandPort = createMockCommandPort();
    const factory = new PipelineStepFactory(eventBus, commandPort);

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
    expect(steps.map((s: WorkflowStep) => s.name)).toEqual([
      'dev',
      'reviewer',
      'qa',
      'pm',
    ]);
  });

  it('should throw when useBMAD is false but no configLoader provided', () => {
    const eventBus = new EventBus();
    const factory = new PipelineStepFactory(eventBus);

    expect(() => factory.build(createConfig(false))).toThrow(
      'ConfigLoader is required for legacy pipeline',
    );
  });

  it('should throw when useBMAD is true but no commandPort provided', () => {
    const eventBus = new EventBus();
    const factory = new PipelineStepFactory(eventBus);

    expect(() => factory.build(createConfig(true))).toThrow(
      'BMADCommandPort is required when workflow.useBMAD is true',
    );
  });

  it('should run full BMAD pipeline with mocked BMADCommandPort', async () => {
    const eventBus = new EventBus();
    const executedCommands: string[] = [];
    const mockPort: BMADCommandPort = {
      async execute(command: string): Promise<BMADCommandResult> {
        executedCommands.push(command);
        return { success: true, output: `executed ${command}`, durationMs: 50 };
      },
    };
    const factory = new PipelineStepFactory(eventBus, mockPort);
    const steps = factory.build(createConfig(true));

    const config = createConfig(true);
    const context = {
      storyId: 'TEST-1',
      projectPath: '/tmp/test',
      config,
      storyContent: '# Test Story\nStatus: in-progress',
    };

    for (const step of steps) {
      const result = await step.run(context);
      expect(result.status).toBe('ok');
    }

    expect(executedCommands).toEqual([
      '/bmad-bmm-dev-story',
      '/bmad-bmm-code-review',
      '/bmad-bmm-qa-automate',
    ]);
  });

  it('should pass story context to BMADCommandPort', async () => {
    const eventBus = new EventBus();
    const receivedContexts: Record<string, string>[] = [];
    const mockPort: BMADCommandPort = {
      async execute(_command: string, context: Record<string, string>): Promise<BMADCommandResult> {
        receivedContexts.push(context);
        return { success: true, output: 'ok', durationMs: 10 };
      },
    };
    const factory = new PipelineStepFactory(eventBus, mockPort);
    const steps = factory.build(createConfig(true));

    const context = {
      storyId: 'EA1-S5',
      projectPath: '/my/project',
      config: createConfig(true),
      storyContent: '# EA1.5: BMAD Wiring\nSome content',
    };

    await steps[0]!.run(context);

    expect(receivedContexts).toHaveLength(1);
    expect(receivedContexts[0]!.projectPath).toBe('/my/project');
    expect(receivedContexts[0]!.story).toContain('EA1-S5');
  });
});
