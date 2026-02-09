import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider } from './BaseProvider.js';
import type { LLMRequest, LLMResponse, LLMConfig, ResourceInfo } from '../types.js';

/**
 * Claude Provider - Uses Anthropic API
 */
export class ClaudeProvider implements LLMProvider {
  private client: Anthropic;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    if (!config.apiKey) {
      throw new Error('Claude provider requires an API key');
    }

    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
  }

  getName(): string {
    return 'claude';
  }

  async execute(request: LLMRequest): Promise<LLMResponse> {
    try {
      const response = await this.client.messages.create({
        model: this.config.modelName,
        max_tokens: request.maxTokens ?? this.config.maxTokens ?? 4096,
        temperature: request.temperature ?? this.config.temperature ?? 1.0,
        messages: request.messages.map((msg) => ({
          role: msg.role === 'system' ? 'user' : msg.role, // Claude handles system differently
          content: msg.content,
        })),
      });

      const content =
        response.content[0]?.type === 'text' ? response.content[0].text : '';

      return {
        content,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        finishReason: response.stop_reason === 'end_turn' ? 'stop' : 'length',
      };
    } catch (error) {
      throw new Error(
        `Claude API error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Simple check: try to list models (or do a minimal request)
      // For now, assume if we have an API key, it's available
      return !!this.config.apiKey;
    } catch {
      return false;
    }
  }

  async getResourceInfo(): Promise<ResourceInfo> {
    // Cloud providers don't have local resource usage
    return {
      memoryUsageMB: 0,
      isRunning: await this.isAvailable(),
      modelName: this.config.modelName,
    };
  }
}
