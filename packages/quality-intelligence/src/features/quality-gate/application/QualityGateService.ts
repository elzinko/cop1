import type { QualityGatePort, QualityGateResult } from '../domain/ports/QualityGatePort.js';

export class QualityGateService implements QualityGatePort {
  async runAll(_context: { storyId: string; projectPath: string }): Promise<QualityGateResult> {
    // Sprint 0 stub — always passes
    return { passed: true, gates: [] };
  }
}
