// @cop1/llm-intelligence — Barrel public
// LLMGateway, LLMProvider port, types, errors

export { LLMGateway } from './features/llm-gateway/application/LLMGateway.js';
export type { LLMProvider } from './features/llm-gateway/domain/ports/LLMProvider.js';
export type { LLMRequest, LLMOptions } from './features/llm-gateway/domain/types/LLMRequest.js';
export type { LLMChunk } from './features/llm-gateway/domain/types/LLMChunk.js';
export { LLMUnavailableError } from './features/llm-gateway/domain/errors/LLMUnavailableError.js';
export { LLMRouter } from './features/llm-gateway/application/LLMRouter.js';

// Model Manager
export { ModelManager } from './features/model-manager/application/ModelManager.js';

// MCP Registry
export {
  MCPRegistry,
  MCPUnauthorizedError,
} from './features/mcp-registry/application/MCPRegistry.js';

// Adaptive Escalation
export { AdaptiveLLMService } from './features/adaptive-escalation/application/AdaptiveLLMService.js';

// Tokens Monitor
export { TokensPerSecMonitor } from './features/tokens-monitor/application/TokensPerSecMonitor.js';

// Ollama Management
export { OllamaManagementAdapter } from './features/ollama-management/application/OllamaManagementAdapter.js';

// Provider Registry
export {
  LLMProviderRegistry,
  ProviderNotFoundError,
} from './features/provider-registry/application/LLMProviderRegistry.js';

// Ollama Adapter
export { OllamaAdapter } from './features/llm-gateway/infrastructure/OllamaAdapter.js';

// LLM Agent Adapters
export { LLMCodeGenerator } from './features/llm-gateway/infrastructure/LLMCodeGenerator.js';
export { LLMReviewer } from './features/llm-gateway/infrastructure/LLMReviewer.js';
