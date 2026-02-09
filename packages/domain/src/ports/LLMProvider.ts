import type { AgentLLMConfig } from '../entities/Agent.js';

/**
 * LLM request/response types
 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Port (interface) for LLM provider
 * Abstracts local (LMStudio, Ollama) and cloud (Claude, OpenAI) LLMs
 */
export interface LLMProvider {
  /**
   * Execute LLM request for a given agent configuration
   */
  execute(config: AgentLLMConfig, request: LLMRequest): Promise<LLMResponse>;

  /**
   * Check if LLM is available (for local LLMs, check if running)
   */
  isAvailable(config: AgentLLMConfig): Promise<boolean>;

  /**
   * Get estimated resource usage for a config
   * Returns memory usage in MB
   */
  getResourceUsage(config: AgentLLMConfig): Promise<number>;
}
