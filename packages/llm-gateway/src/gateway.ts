import type { LLMProvider } from './providers/BaseProvider.js';
import { ClaudeProvider } from './providers/ClaudeProvider.js';
import { LocalProvider } from './providers/LocalProvider.js';
import type { LLMConfig, LLMRequest, LLMResponse, ResourceInfo } from './types.js';

/**
 * LLM Gateway - Factory and router for different LLM providers
 * Supports local (LMStudio, Ollama) and cloud (Claude, OpenAI) providers
 */
export class LLMGateway {
  private providers: Map<string, LLMProvider> = new Map();

  /**
   * Register a provider with a unique key
   */
  registerProvider(key: string, provider: LLMProvider): void {
    this.providers.set(key, provider);
  }

  /**
   * Create and register a provider from config
   */
  createProvider(key: string, config: LLMConfig): LLMProvider {
    let provider: LLMProvider;

    switch (config.provider) {
      case 'claude':
        provider = new ClaudeProvider(config);
        break;
      case 'local':
        provider = new LocalProvider(config);
        break;
      case 'openai':
        // TODO: Implement OpenAI provider
        throw new Error('OpenAI provider not yet implemented');
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }

    this.registerProvider(key, provider);
    return provider;
  }

  /**
   * Get a provider by key
   */
  getProvider(key: string): LLMProvider | undefined {
    return this.providers.get(key);
  }

  /**
   * Execute a request using a specific provider
   */
  async execute(providerKey: string, request: LLMRequest): Promise<LLMResponse> {
    const provider = this.getProvider(providerKey);
    if (!provider) {
      throw new Error(`Provider ${providerKey} not found`);
    }

    const isAvailable = await provider.isAvailable();
    if (!isAvailable) {
      throw new Error(`Provider ${providerKey} is not available`);
    }

    return provider.execute(request);
  }

  /**
   * Execute a request using a config (auto-creates provider if needed)
   */
  async executeWithConfig(config: LLMConfig, request: LLMRequest): Promise<LLMResponse> {
    const key = `${config.provider}:${config.modelName}`;

    if (!this.providers.has(key)) {
      this.createProvider(key, config);
    }

    return this.execute(key, request);
  }

  /**
   * Check if a provider is available
   */
  async isProviderAvailable(providerKey: string): Promise<boolean> {
    const provider = this.getProvider(providerKey);
    if (!provider) {
      return false;
    }

    return provider.isAvailable();
  }

  /**
   * Get resource info for all providers
   */
  async getAllResourceInfo(): Promise<Map<string, ResourceInfo>> {
    const resourceMap = new Map<string, ResourceInfo>();

    for (const [key, provider] of this.providers) {
      const info = await provider.getResourceInfo();
      resourceMap.set(key, info);
    }

    return resourceMap;
  }

  /**
   * Get total memory usage across all running local providers
   */
  async getTotalMemoryUsage(): Promise<number> {
    const resourceMap = await this.getAllResourceInfo();
    let total = 0;

    for (const info of resourceMap.values()) {
      if (info.isRunning) {
        total += info.memoryUsageMB;
      }
    }

    return total;
  }
}
