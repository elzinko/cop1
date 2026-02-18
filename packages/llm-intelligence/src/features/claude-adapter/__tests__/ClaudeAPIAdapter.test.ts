import { describe, expect, it } from 'vitest';
import { ClaudeAPIAdapter } from '../application/ClaudeAPIAdapter.js';

describe('ClaudeAPIAdapter', () => {
  it('should implement LLMProvider interface', async () => {
    const adapter = new ClaudeAPIAdapter(() => 'test-key');
    const chunks: string[] = [];

    for await (const chunk of adapter.complete({
      prompt: 'Hello',
      model: 'claude-sonnet-4-5-20250929',
    })) {
      chunks.push(chunk.text);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('Claude response');
  });

  it('should throw when no API key', async () => {
    const adapter = new ClaudeAPIAdapter(() => '');

    await expect(async () => {
      for await (const _chunk of adapter.complete({
        prompt: 'test',
        model: 'claude-sonnet-4-5-20250929',
      })) {
        // consume
      }
    }).rejects.toThrow('Claude API key not configured');
  });

  it('should report health based on API key', async () => {
    const withKey = new ClaudeAPIAdapter(() => 'key');
    const noKey = new ClaudeAPIAdapter(() => '');

    expect((await withKey.health()).available).toBe(true);
    expect((await withKey.health()).models.length).toBeGreaterThan(0);
    expect((await noKey.health()).available).toBe(false);
  });
});
