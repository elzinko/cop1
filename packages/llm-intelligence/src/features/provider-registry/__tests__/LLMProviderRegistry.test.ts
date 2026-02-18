import { describe, expect, it } from 'vitest';
import type { LLMProvider } from '../../../features/llm-gateway/domain/ports/LLMProvider.js';
import { LLMProviderRegistry, ProviderNotFoundError } from '../application/LLMProviderRegistry.js';

function createMockProvider(): LLMProvider {
  return {
    async *complete() {
      yield { text: 'mock', done: true };
    },
    async health() {
      return { available: true, models: ['mock'] };
    },
  };
}

describe('LLMProviderRegistry', () => {
  it('should register and retrieve active provider', () => {
    const registry = new LLMProviderRegistry();
    registry.register('ollama', createMockProvider());

    const active = registry.getActive();
    expect(active?.id).toBe('ollama');
  });

  it('should switch active provider', () => {
    const registry = new LLMProviderRegistry();
    registry.register('ollama', createMockProvider());
    registry.register('claude', createMockProvider());

    registry.setActive('claude');
    expect(registry.getActive()?.id).toBe('claude');
  });

  it('should throw ProviderNotFoundError for unknown provider', () => {
    const registry = new LLMProviderRegistry();
    registry.register('ollama', createMockProvider());

    expect(() => registry.setActive('unknown')).toThrow(ProviderNotFoundError);
  });

  it('should list registered providers', () => {
    const registry = new LLMProviderRegistry();
    registry.register('ollama', createMockProvider());
    registry.register('claude', createMockProvider());

    expect(registry.list()).toEqual(['ollama', 'claude']);
  });
});
