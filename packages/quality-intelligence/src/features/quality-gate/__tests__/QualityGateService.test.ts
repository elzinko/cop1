import { describe, expect, it } from 'vitest';
import { QualityGateService } from '../application/QualityGateService.js';
import type { GatePort } from '../domain/ports/GatePort.js';

function createGate(name: string, passed: boolean, details?: string): GatePort {
  return {
    name,
    check: () => ({ name, passed, details }),
  };
}

describe('QualityGateService', () => {
  it('should pass when all gates pass', async () => {
    const service = new QualityGateService([
      createGate('coverage', true),
      createGate('static-analysis', true),
    ]);

    const result = await service.runAll({ storyId: 'E1-S1', projectPath: '/tmp' });

    expect(result.passed).toBe(true);
    expect(result.gates).toHaveLength(2);
  });

  it('should fail when any gate fails', async () => {
    const service = new QualityGateService([
      createGate('coverage', true),
      createGate('static-analysis', false, '3 violations'),
    ]);

    const result = await service.runAll({ storyId: 'E1-S1', projectPath: '/tmp' });

    expect(result.passed).toBe(false);
  });

  it('should stop at first failure in fail-fast mode', async () => {
    const gate3 = createGate('sonarqube', true);
    const checkSpy = gate3.check;
    let gate3Called = false;
    gate3.check = (ctx) => {
      gate3Called = true;
      return checkSpy(ctx);
    };

    const service = new QualityGateService(
      [createGate('coverage', false), createGate('static-analysis', true), gate3],
      { failFast: true },
    );

    const result = await service.runAll({ storyId: 'E1-S1', projectPath: '/tmp' });

    expect(result.passed).toBe(false);
    expect(result.gates).toHaveLength(1);
    expect(gate3Called).toBe(false);
  });

  it('should run all gates when fail-fast is disabled', async () => {
    const service = new QualityGateService(
      [
        createGate('coverage', false, 'below threshold'),
        createGate('static-analysis', false, 'violations'),
      ],
      { failFast: false },
    );

    const result = await service.runAll({ storyId: 'E1-S1', projectPath: '/tmp' });

    expect(result.passed).toBe(false);
    expect(result.gates).toHaveLength(2);
  });

  it('should pass with no gates configured', async () => {
    const service = new QualityGateService();

    const result = await service.runAll({ storyId: 'E1-S1', projectPath: '/tmp' });

    expect(result.passed).toBe(true);
    expect(result.gates).toHaveLength(0);
  });
});
