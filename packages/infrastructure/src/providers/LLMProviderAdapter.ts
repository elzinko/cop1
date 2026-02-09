import type { LLMProvider, LLMRequest, LLMResponse } from '@cop1/domain';
import type { AgentLLMConfig } from '@cop1/domain';
import { LLMGateway, type LLMConfig } from '@cop1/llm-gateway';

/**
 * LLM Provider Adapter
 * Adapts the llm-gateway package to the domain's LLMProvider port
 */
export class LLMProviderAdapter implements LLMProvider {
  private gateway: LLMGateway;

  constructor() {
    this.gateway = new LLMGateway();
  }

  /**
   * Convert domain AgentLLMConfig to llm-gateway LLMConfig
   */
  private toGatewayConfig(config: AgentLLMConfig): LLMConfig {
    return {
      provider: config.provider as 'claude' | 'openai' | 'local',
      modelName: config.modelName,
      apiKey: config.apiKey,
      endpoint: config.endpoint,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    };
  }

  async execute(config: AgentLLMConfig, request: LLMRequest): Promise<LLMResponse> {
    const gatewayConfig = this.toGatewayConfig(config);
    return this.gateway.executeWithConfig(gatewayConfig, request);
  }

  async isAvailable(config: AgentLLMConfig): Promise<boolean> {
    const gatewayConfig = this.toGatewayConfig(config);
    const key = `${gatewayConfig.provider}:${gatewayConfig.modelName}`;

    // Create provider if it doesn't exist
    if (!this.gateway.getProvider(key)) {
      this.gateway.createProvider(key, gatewayConfig);
    }

    return this.gateway.isProviderAvailable(key);
  }

  async getResourceUsage(config: AgentLLMConfig): Promise<number> {
    // For cloud providers, return 0 (no local resources)
    if (config.provider === 'cloud') {
      return 0;
    }

    // For local providers, get resource info
    const gatewayConfig = this.toGatewayConfig(config);
    const key = `${gatewayConfig.provider}:${gatewayConfig.modelName}`;

    if (!this.gateway.getProvider(key)) {
      this.gateway.createProvider(key, gatewayConfig);
    }

    const provider = this.gateway.getProvider(key);
    if (!provider) {
      return 0;
    }

    const resourceInfo = await provider.getResourceInfo();
    return resourceInfo.memoryUsageMB;
  }
}
