import type { LLMChunk } from '../types/LLMChunk.js';
import type { LLMRequest } from '../types/LLMRequest.js';

export interface LLMProvider {
  complete(request: LLMRequest): AsyncIterable<LLMChunk>;
  health(): Promise<{ available: boolean; models: string[] }>;
}
