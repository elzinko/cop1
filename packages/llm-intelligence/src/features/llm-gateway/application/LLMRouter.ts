import type { ConfigPort } from '@cop1/shared-kernel';

export class LLMRouter {
  constructor(private readonly configPort: ConfigPort) {}

  route(commandType: string): string {
    const config = this.configPort.get();
    const routing = config.llm_routing;

    if (routing[commandType]) {
      return routing[commandType];
    }

    if (routing.default) {
      return routing.default;
    }

    throw new Error(
      `No LLM model configured for command type "${commandType}" and no default routing defined`,
    );
  }
}
