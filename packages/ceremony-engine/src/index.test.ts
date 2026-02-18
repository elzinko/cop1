import { describe, expect, it } from 'vitest';

describe('@cop1/ceremony-engine', () => {
  it('should be importable', async () => {
    const mod = await import('./index.js');
    expect(mod).toBeDefined();
  });
});
