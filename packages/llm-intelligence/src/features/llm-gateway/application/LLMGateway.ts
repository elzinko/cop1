import type { EventBus } from '@cop1/shared-kernel';
import type { LLMProvider } from '../domain/ports/LLMProvider.js';
import type { LLMChunk } from '../domain/types/LLMChunk.js';
import type { LLMOptions } from '../domain/types/LLMRequest.js';
import type { LLMRouter } from './LLMRouter.js';

export class LLMGateway {
  private router: LLMRouter | null = null;

  constructor(
    private readonly provider: LLMProvider,
    private readonly eventBus?: EventBus,
  ) {}

  withRouter(router: LLMRouter): this {
    this.router = router;
    return this;
  }

  complete(prompt: string, model: string, options?: LLMOptions): AsyncIterable<LLMChunk> {
    const stream = this.provider.complete({ prompt, model, options });
    return this.trackCompletion(stream, model, 'direct', prompt.length);
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
    const stream = this.provider.complete({ prompt, model, options });
    return this.trackCompletion(stream, model, commandType, prompt.length);
  }

  health(): Promise<{ available: boolean; models: string[] }> {
    return this.provider.health();
  }

  private trackCompletion(
    stream: AsyncIterable<LLMChunk>,
    model: string,
    agentType: string,
    promptLength: number,
  ): AsyncIterable<LLMChunk> {
    if (!this.eventBus) {
      return stream;
    }

    const eventBus = this.eventBus;

    async function* tracked(): AsyncIterable<LLMChunk> {
      eventBus.emit('llm.call.started', {
        model,
        agentType,
        promptLength,
        timestamp: new Date().toISOString(),
      });

      const startTime = Date.now();
      let responseLength = 0;

      for await (const chunk of stream) {
        responseLength += chunk.text.length;
        yield chunk;
      }

      const durationMs = Date.now() - startTime;
      const tokenCount = Math.ceil(responseLength / 4);

      eventBus.emit('llm.call.completed', {
        model,
        agentType,
        promptLength,
        responseLength,
        durationMs,
        tokenCount,
      });
    }

    return tracked();
  }
}
