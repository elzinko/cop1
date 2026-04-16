import type { BMADCommandRunner } from '../../application/OrchestratorService.js';
import { inferNextStatus } from '../DefaultBMADCommandRunner.js';

/**
 * Stub `BMADCommandRunner` — returns canned transitions with no real BMAD
 * invocation. Kept accessible for tests and for the `--runner stub` CLI
 * opt-in (dev / smoke testing without SDK cost). NOT the default.
 *
 * Status mapping matches the historical stub behaviour pre-EA13-S2 so tests
 * written against the old default keep passing.
 */
export const stubBMADCommandRunner: BMADCommandRunner = async ({ command }) => ({
  success: true,
  nextStatus: inferNextStatus(command),
});
