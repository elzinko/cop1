import { describe, expect, it, vi } from 'vitest';
import { StepByStepController } from '../application/StepByStepController.js';

describe('StepByStepController', () => {
  it('defaults to mode "none" and auto-continues', async () => {
    const ctrl = new StepByStepController();
    expect(ctrl.getMode()).toBe('none');
    const result = await ctrl.awaitApproval({ phase: 'intra' });
    expect(result).toBe('continue');
    expect(ctrl.isPaused()).toBe(false);
  });

  it('intra mode activates resolver on intra phase only', async () => {
    const resolver = vi.fn(async () => 'continue' as const);
    const ctrl = new StepByStepController(resolver);
    ctrl.setMode('intra');

    await ctrl.awaitApproval({ phase: 'intra' });
    await ctrl.awaitApproval({ phase: 'inter' });

    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it('inter mode activates resolver on inter phase only', async () => {
    const resolver = vi.fn(async () => 'continue' as const);
    const ctrl = new StepByStepController(resolver);
    ctrl.setMode('inter');

    await ctrl.awaitApproval({ phase: 'intra' });
    await ctrl.awaitApproval({ phase: 'inter' });

    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it('both mode activates resolver on both phases', async () => {
    const resolver = vi.fn(async () => 'continue' as const);
    const ctrl = new StepByStepController(resolver);
    ctrl.setMode('both');

    await ctrl.awaitApproval({ phase: 'intra' });
    await ctrl.awaitApproval({ phase: 'inter' });

    expect(resolver).toHaveBeenCalledTimes(2);
  });

  it('propagates resolver return value (abort)', async () => {
    const resolver = vi.fn(async () => 'abort' as const);
    const ctrl = new StepByStepController(resolver);
    ctrl.setMode('both');

    const result = await ctrl.awaitApproval({ phase: 'intra', label: 'dev-story' });
    expect(result).toBe('abort');
  });

  it('isPaused returns true during resolver execution', async () => {
    let duringCall: boolean | undefined;
    const ctrl = new StepByStepController(async () => {
      duringCall = ctrl.isPaused();
      return 'continue';
    });
    ctrl.setMode('intra');

    expect(ctrl.isPaused()).toBe(false);
    await ctrl.awaitApproval({ phase: 'intra' });
    expect(duringCall).toBe(true);
    expect(ctrl.isPaused()).toBe(false);
  });
});
