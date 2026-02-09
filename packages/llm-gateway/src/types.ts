/**
 * LLM Gateway Types
 * Unified types for local and cloud LLM providers
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: 'stop' | 'length' | 'error';
}

export interface LLMConfig {
  provider: 'claude' | 'openai' | 'local';
  modelName: string;
  apiKey?: string; // For cloud providers
  endpoint?: string; // For local providers (e.g., http://localhost:1234/v1)
  temperature?: number;
  maxTokens?: number;
}

export interface ResourceInfo {
  memoryUsageMB: number;
  isRunning: boolean;
  modelName: string;
}
