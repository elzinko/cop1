import type { LLMProvider } from '../../llm-gateway/domain/ports/LLMProvider.js';
import type { LLMChunk } from '../../llm-gateway/domain/types/LLMChunk.js';
import type { LLMRequest } from '../../llm-gateway/domain/types/LLMRequest.js';

export class ClaudeAPIAdapter implements LLMProvider {
  constructor(private readonly getApiKey: () => string) {}

  async *complete(request: LLMRequest): AsyncIterable<LLMChunk> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Claude API key not configured');
    }

    // In real implementation, calls Anthropic API
    // For MVP: port interface satisfied, real HTTP call deferred
    yield {
      text: `[Claude response for: ${request.prompt.slice(0, 50)}]`,
      done: true,
    };
  }

  async health(): Promise<{ available: boolean; models: string[] }> {
    const apiKey = this.getApiKey();
    return {
      available: !!apiKey,
      models: apiKey ? ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'] : [],
    };
  }
}
