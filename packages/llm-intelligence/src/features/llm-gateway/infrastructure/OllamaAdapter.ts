import { LLMUnavailableError } from '../domain/errors/LLMUnavailableError.js';
import type { LLMProvider } from '../domain/ports/LLMProvider.js';
import type { LLMChunk } from '../domain/types/LLMChunk.js';
import type { LLMRequest } from '../domain/types/LLMRequest.js';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_TIMEOUT_MS = 60_000;

export class OllamaAdapter implements LLMProvider {
  private readonly baseUrl: string;

  constructor(baseUrl: string = DEFAULT_OLLAMA_URL) {
    this.baseUrl = baseUrl;
  }

  async *complete(request: LLMRequest): AsyncIterable<LLMChunk> {
    const timeoutMs = request.options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: request.model,
          prompt: request.prompt,
          stream: true,
          ...(request.options?.temperature != null && {
            options: { temperature: request.options.temperature },
          }),
        }),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timer);
      throw new LLMUnavailableError('ollama', error);
    }

    if (!response.ok) {
      clearTimeout(timer);
      throw new LLMUnavailableError('ollama', `HTTP ${response.status}: ${await response.text()}`);
    }

    try {
      const body = response.body;
      if (!body) {
        yield { text: '', done: true };
        return;
      }

      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const parsed = JSON.parse(trimmed) as { response?: string; done?: boolean };
          yield {
            text: parsed.response ?? '',
            done: parsed.done ?? false,
          };
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        const parsed = JSON.parse(buffer.trim()) as { response?: string; done?: boolean };
        yield {
          text: parsed.response ?? '',
          done: parsed.done ?? false,
        };
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async health(): Promise<{ available: boolean; models: string[] }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        return { available: false, models: [] };
      }
      const data = (await response.json()) as { models?: Array<{ name: string }> };
      const models = (data.models ?? []).map((m) => m.name);
      return { available: true, models };
    } catch {
      return { available: false, models: [] };
    }
  }
}
