import { describe, expect, it } from 'vitest';

describe('@cop1/observability', () => {
  it('should be importable', async () => {
    const mod = await import('./index.js');
    expect(mod).toBeDefined();
  });
});
