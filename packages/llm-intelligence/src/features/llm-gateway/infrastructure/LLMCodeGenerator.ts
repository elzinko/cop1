import type { CodeGeneratorPort } from '@cop1/sprint-core';
import type { LLMGateway } from '../application/LLMGateway.js';

export class LLMCodeGenerator implements CodeGeneratorPort {
  constructor(private readonly gateway: LLMGateway) {}

  async generate(prompt: string): Promise<string> {
    const stream = this.gateway.completeForAgent('dev', prompt);
    let result = '';
    for await (const chunk of stream) {
      result += chunk.text;
    }
    return result;
  }
}
