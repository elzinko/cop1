import type { QualityGatePort } from '@cop1/quality-intelligence';
import type { Cop1Config } from '@cop1/shared-kernel';
import { EventBus } from '@cop1/shared-kernel';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckpointPhase } from '../../checkpoint/domain/CheckpointState.js';
import type { CheckpointState } from '../../checkpoint/domain/CheckpointState.js';
import { WorkflowEngine } from '../application/WorkflowEngine.js';
import type { StepResult } from '../domain/StepResult.js';
import type { WorkflowContext } from '../domain/WorkflowContext.js';
import { WorkflowEvent } from '../domain/WorkflowEvent.js';
import type { WorkflowStep } from '../domain/WorkflowStep.js';

function createStubStep(name: string, result: StepResult = { status: 'ok' }): WorkflowStep {
  return {
    name,
    run: vi.fn(async () => result),
  };
}

function createContext(): WorkflowContext {
  return {
    storyId: 'TEST-001',
    projectPath: '/tmp/test',
    config: {
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
    } satisfies Cop1Config,
  };
}

describe('WorkflowEngine', () => {
  let eventBus: EventBus;
  let qualityGate: QualityGatePort;
  let engine: WorkflowEngine;

  beforeEach(() => {
    eventBus = new EventBus();
    qualityGate = { runAll: vi.fn(async () => ({ passed: true, gates: [] })) };
    engine = new WorkflowEngine(eventBus, qualityGate);
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  it('should execute all steps in order', async () => {
    const steps = [createStubStep('dev'), createStubStep('reviewer'), createStubStep('qa')];
    const context = createContext();

    const result = await engine.run(context, steps);

    expect(result.status).toBe('ok');
    expect(steps[0]?.run).toHaveBeenCalledOnce();
    expect(steps[1]?.run).toHaveBeenCalledOnce();
    expect(steps[2]?.run).toHaveBeenCalledOnce();
  });

  it('should call QualityGate between steps but not after last', async () => {
    const steps = [createStubStep('dev'), createStubStep('reviewer'), createStubStep('qa')];
    const context = createContext();

    await engine.run(context, steps);

    // 3 steps → 2 quality gate calls (between 1-2 and 2-3)
    expect(qualityGate.runAll).toHaveBeenCalledTimes(2);
  });

  it('should stop on failed step and emit workflow.failed', async () => {
    const steps = [
      createStubStep('dev'),
      createStubStep('reviewer', { status: 'failed', error: new Error('code review failed') }),
      createStubStep('qa'),
    ];
    const context = createContext();
    const events: string[] = [];

    eventBus.on(WorkflowEvent.WORKFLOW_FAILED, () => events.push('failed'));

    const result = await engine.run(context, steps);

    expect(result.status).toBe('failed');
    expect(steps[2]?.run).not.toHaveBeenCalled();
    expect(events).toContain('failed');
  });

  it('should emit events in correct order for successful workflow', async () => {
    const steps = [createStubStep('dev'), createStubStep('reviewer')];
    const context = createContext();
    const events: string[] = [];

    eventBus.on(WorkflowEvent.WORKFLOW_STARTED, () => events.push('workflow.started'));
    eventBus.on(WorkflowEvent.STEP_STARTED, () => events.push('step.started'));
    eventBus.on(WorkflowEvent.STEP_COMPLETED, () => events.push('step.completed'));
    eventBus.on(WorkflowEvent.WORKFLOW_COMPLETED, () => events.push('workflow.completed'));

    await engine.run(context, steps);

    expect(events).toEqual([
      'workflow.started',
      'step.started',
      'step.completed',
      'step.started',
      'step.completed',
      'workflow.completed',
    ]);
  });

  it('should run integration test with all 4 agent stubs', async () => {
    // Import real stubs
    const { DevAgentStep } = await import('../infrastructure/steps/DevAgentStep.js');
    const { ReviewerAgentStep } = await import('../infrastructure/steps/ReviewerAgentStep.js');
    const { QAAgentStep } = await import('../infrastructure/steps/QAAgentStep.js');
    const { PMAgentStep } = await import('../infrastructure/steps/PMAgentStep.js');

    const steps = [
      new DevAgentStep(),
      new ReviewerAgentStep(),
      new QAAgentStep(),
      new PMAgentStep(),
    ];
    const context = createContext();
    const events: string[] = [];

    eventBus.on(WorkflowEvent.STEP_COMPLETED, (payload) => {
      const p = payload as { step: string };
      events.push(p.step);
    });

    const result = await engine.run(context, steps);

    expect(result.status).toBe('ok');
    expect(events).toEqual(['dev', 'reviewer', 'qa', 'pm']);
  });

  describe('resume', () => {
    function createCheckpoint(stepIndex: number, stepName: string): CheckpointState {
      return {
        storyId: 'TEST-001',
        agentName: 'dev',
        stepIndex,
        stepName,
        timestamp: new Date().toISOString(),
        phase: CheckpointPhase.AGENT_STARTED,
      };
    }

    it('should skip completed steps and resume from checkpoint', async () => {
      const steps = [createStubStep('dev'), createStubStep('reviewer'), createStubStep('qa')];
      const context = createContext();
      const checkpoint = createCheckpoint(1, 'reviewer');

      const result = await engine.resume(context, steps, checkpoint);

      expect(result.status).toBe('ok');
      expect(steps[0]?.run).not.toHaveBeenCalled();
      expect(steps[1]?.run).toHaveBeenCalledOnce();
      expect(steps[2]?.run).toHaveBeenCalledOnce();
    });

    it('should emit workflow.resumed event', async () => {
      const steps = [createStubStep('dev'), createStubStep('reviewer')];
      const context = createContext();
      const checkpoint = createCheckpoint(1, 'reviewer');
      const events: string[] = [];

      eventBus.on(WorkflowEvent.WORKFLOW_RESUMED, () => events.push('resumed'));
      eventBus.on(WorkflowEvent.STEP_STARTED, () => events.push('step.started'));
      eventBus.on(WorkflowEvent.STEP_COMPLETED, () => events.push('step.completed'));
      eventBus.on(WorkflowEvent.WORKFLOW_COMPLETED, () => events.push('workflow.completed'));

      await engine.resume(context, steps, checkpoint);

      expect(events).toEqual(['resumed', 'step.started', 'step.completed', 'workflow.completed']);
    });

    it('should fail for invalid checkpoint stepIndex', async () => {
      const steps = [createStubStep('dev')];
      const context = createContext();
      const checkpoint = createCheckpoint(5, 'nonexistent');

      const result = await engine.resume(context, steps, checkpoint);

      expect(result.status).toBe('failed');
    });

    it('should resume from last step', async () => {
      const steps = [createStubStep('dev'), createStubStep('reviewer'), createStubStep('qa')];
      const context = createContext();
      const checkpoint = createCheckpoint(2, 'qa');

      const result = await engine.resume(context, steps, checkpoint);

      expect(result.status).toBe('ok');
      expect(steps[0]?.run).not.toHaveBeenCalled();
      expect(steps[1]?.run).not.toHaveBeenCalled();
      expect(steps[2]?.run).toHaveBeenCalledOnce();
    });
  });
});
