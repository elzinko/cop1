import type { LLMProvider } from '../../llm-gateway/domain/ports/LLMProvider.js';

export class ProviderNotFoundError extends Error {
  constructor(providerId: string, availableProviders: string[]) {
    super(`Provider '${providerId}' not found. Available: ${availableProviders.join(', ')}`);
    this.name = 'ProviderNotFoundError';
  }
}

export class LLMProviderRegistry {
  private providers = new Map<string, LLMProvider>();
  private activeId: string | null = null;

  register(id: string, provider: LLMProvider): void {
    this.providers.set(id, provider);
    if (!this.activeId) {
      this.activeId = id;
    }
  }

  getActive(): { id: string; provider: LLMProvider } | null {
    if (!this.activeId) return null;
    const provider = this.providers.get(this.activeId);
    if (!provider) return null;
    return { id: this.activeId, provider };
  }

  setActive(providerId: string): void {
    if (!this.providers.has(providerId)) {
      throw new ProviderNotFoundError(providerId, [...this.providers.keys()]);
    }
    this.activeId = providerId;
  }

  list(): string[] {
    return [...this.providers.keys()];
  }
}
