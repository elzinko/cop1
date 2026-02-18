export interface OllamaModel {
  name: string;
  size: number;
  modifiedAt: string;
}

export interface OllamaManagementPort {
  listModels(): Promise<OllamaModel[]>;
  pullModel(modelId: string): AsyncIterable<{ status: string; completed: number; total: number }>;
  deleteModel(modelId: string): Promise<void>;
}

export class OllamaManagementAdapter implements OllamaManagementPort {
  constructor(private readonly baseUrl: string = 'http://localhost:11434') {}

  async listModels(): Promise<OllamaModel[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }
    const data = (await response.json()) as { models?: OllamaModel[] };
    return data.models ?? [];
  }

  async *pullModel(
    modelId: string,
  ): AsyncIterable<{ status: string; completed: number; total: number }> {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelId, stream: true }),
    });

    if (!response.ok) {
      throw new Error(`Ollama pull error: ${response.status}`);
    }

    if (!response.body) {
      yield { status: 'error', completed: 0, total: 0 };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line) as { status: string; completed?: number; total?: number };
          yield {
            status: event.status,
            completed: event.completed ?? 0,
            total: event.total ?? 0,
          };
        } catch {
          // skip malformed lines
        }
      }
    }
  }

  async deleteModel(modelId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelId }),
    });

    if (!response.ok) {
      throw new Error(`Ollama delete error: ${response.status}`);
    }
  }
}
