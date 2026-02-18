export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface LLMRequest {
  prompt: string;
  model: string;
  options?: LLMOptions;
}
