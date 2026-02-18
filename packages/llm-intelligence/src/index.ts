// @cop1/llm-intelligence — Barrel public
// LLMGateway, LLMProvider port, types, errors

export { LLMGateway } from './features/llm-gateway/application/LLMGateway.js';
export type { LLMProvider } from './features/llm-gateway/domain/ports/LLMProvider.js';
export type { LLMRequest, LLMOptions } from './features/llm-gateway/domain/types/LLMRequest.js';
export type { LLMChunk } from './features/llm-gateway/domain/types/LLMChunk.js';
export { LLMUnavailableError } from './features/llm-gateway/domain/errors/LLMUnavailableError.js';
export { LLMRouter } from './features/llm-gateway/application/LLMRouter.js';
