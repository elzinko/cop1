import type { GatePort } from '../domain/ports/GatePort.js';
import type { QualityGatePort, QualityGateResult } from '../domain/ports/QualityGatePort.js';

export class QualityGateService implements QualityGatePort {
  private readonly gates: GatePort[];
  private readonly failFast: boolean;

  constructor(gates: GatePort[] = [], options?: { failFast?: boolean }) {
    this.gates = gates;
    this.failFast = options?.failFast ?? true;
  }

  async runAll(context: { storyId: string; projectPath: string }): Promise<QualityGateResult> {
    const results: Array<{ name: string; passed: boolean; message?: string }> = [];
    let allPassed = true;

    for (const gate of this.gates) {
      const result = gate.check({ worktreePath: context.projectPath });
      results.push({
        name: result.name,
        passed: result.passed,
        message: result.details,
      });

      if (!result.passed) {
        allPassed = false;
        if (this.failFast) break;
      }
    }

    return { passed: allPassed, gates: results };
  }
}
