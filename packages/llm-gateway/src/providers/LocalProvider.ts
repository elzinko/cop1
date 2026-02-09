import type { LLMProvider } from './BaseProvider.js';
import type { LLMRequest, LLMResponse, LLMConfig, ResourceInfo } from '../types.js';

/**
 * Local Provider - For LMStudio, Ollama, or any OpenAI-compatible local endpoint
 * These tools expose an OpenAI-compatible API on localhost
 */
export class LocalProvider implements LLMProvider {
  private config: LLMConfig;
  private endpoint: string;

  constructor(config: LLMConfig) {
    if (!config.endpoint) {
      throw new Error('Local provider requires an endpoint (e.g., http://localhost:1234/v1)');
    }

    this.config = config;
    this.endpoint = config.endpoint;
  }

  getName(): string {
    return 'local';
  }

  async execute(request: LLMRequest): Promise<LLMResponse> {
    try {
      // Use OpenAI-compatible API format
      const response = await fetch(`${this.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.modelName,
          messages: request.messages,
          temperature: request.temperature ?? this.config.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? this.config.maxTokens ?? 2048,
        }),
      });

      if (!response.ok) {
        throw new Error(`Local LLM API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;

      return {
        content: data.choices[0]?.message?.content ?? '',
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
        finishReason: data.choices[0]?.finish_reason === 'stop' ? 'stop' : 'length',
      };
    } catch (error) {
      throw new Error(
        `Local LLM error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if the local server is running
      const response = await fetch(`${this.endpoint}/models`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5s timeout
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async getResourceInfo(): Promise<ResourceInfo> {
    // For local LLMs, we could query system resources
    // For now, return estimated values
    // In production, this could query the local LLM server's metrics endpoint
    return {
      memoryUsageMB: 4096, // Estimated (depends on model size)
      isRunning: await this.isAvailable(),
      modelName: this.config.modelName,
    };
  }
}
