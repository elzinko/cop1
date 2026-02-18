import { describe, expect, it } from 'vitest';
import type { SonarConfig } from '../application/SonarQubeAdapter.js';
import { SonarQubeAdapter } from '../application/SonarQubeAdapter.js';

describe('SonarQubeAdapter', () => {
  it('should refuse scan without consent', async () => {
    const adapter = new SonarQubeAdapter();
    const config: SonarConfig = {
      projectKey: 'cop1',
      serverUrl: 'http://localhost:9000',
      consent: false,
    };

    const result = await adapter.scan('/tmp/test', config);
    expect(result.passed).toBe(false);
    expect(result.error).toBe('sonar_consent_required');
  });

  it('should handle timeout gracefully', async () => {
    const adapter = new SonarQubeAdapter(100); // Very short timeout
    const config: SonarConfig = {
      projectKey: 'cop1',
      serverUrl: 'http://localhost:9000',
      consent: true,
    };

    const result = await adapter.scan('/tmp/nonexistent', config);
    expect(result.passed).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should return result structure', async () => {
    const adapter = new SonarQubeAdapter();
    const config: SonarConfig = {
      projectKey: 'test',
      serverUrl: 'http://localhost:9000',
      consent: false,
    };

    const result = await adapter.scan('/tmp', config);
    expect(result).toHaveProperty('passed');
  });
});
