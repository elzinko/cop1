import type { LLMProvider } from '../domain/ports/LLMProvider.js';
import type { LLMChunk } from '../domain/types/LLMChunk.js';
import type { LLMOptions } from '../domain/types/LLMRequest.js';
import type { LLMRouter } from './LLMRouter.js';

export class LLMGateway {
  private router: LLMRouter | null = null;

  constructor(private readonly provider: LLMProvider) {}

  withRouter(router: LLMRouter): this {
    this.router = router;
    return this;
  }

  complete(prompt: string, model: string, options?: LLMOptions): AsyncIterable<LLMChunk> {
    return this.provider.complete({ prompt, model, options });
  }

  completeForAgent(
    commandType: string,
    prompt: string,
    options?: LLMOptions,
  ): AsyncIterable<LLMChunk> {
    if (!this.router) {
      throw new Error('LLMRouter not configured. Call withRouter() first.');
    }
    const model = this.router.route(commandType);
    return this.provider.complete({ prompt, model, options });
  }

  health(): Promise<{ available: boolean; models: string[] }> {
    return this.provider.health();
  }
}
