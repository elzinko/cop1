import type { LLMRequest, LLMResponse, ResourceInfo } from '../types.js';

/**
 * Base interface for all LLM providers
 * Implements the Strategy pattern for different LLM backends
 */
export interface LLMProvider {
  /**
   * Execute an LLM request
   */
  execute(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Check if the provider is available
   * For local: check if server is running
   * For cloud: check if API key is valid
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get resource usage information
   */
  getResourceInfo(): Promise<ResourceInfo>;

  /**
   * Get provider name
   */
  getName(): string;
}
