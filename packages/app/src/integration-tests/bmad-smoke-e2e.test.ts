import { EventBus } from '@cop1/shared-kernel';
import { ClaudeCliAdapter } from '@cop1/sprint-core';
import { describe, expect, it } from 'vitest';

/**
 * E2E Smoke Test — Local Only
 *
 * Spawns the REAL `claude` CLI binary and verifies basic BMAD command execution.
 * Guarded by RUN_E2E=true environment variable — does NOT run in CI.
 *
 * Prerequisites:
 *   - `claude` CLI must be installed and available on PATH
 *   - Valid API key configured in the environment
 *
 * Run manually: RUN_E2E=true pnpm test packages/app/src/integration-tests/bmad-smoke-e2e.test.ts
 */
describe.runIf(process.env.RUN_E2E === 'true')('BMAD E2E Smoke Test (real Claude CLI)', () => {
  it('should spawn real claude CLI and receive parseable JSON output', async () => {
    const eventBus = new EventBus();
    const adapter = new ClaudeCliAdapter(eventBus, { timeoutMs: 120_000 });

    const result = await adapter.execute('/bmad-bmm-dev-story', {
      projectPath: process.cwd(),
      story: '# Smoke Test Story\n\nThis is a minimal smoke test. Respond with a brief acknowledgment.',
    });

    // We only validate the result conforms to BMADCommandResult schema
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('output');
    expect(result).toHaveProperty('durationMs');
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.output).toBe('string');
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.output.length).toBeGreaterThan(0);
  }, 180_000);
});
