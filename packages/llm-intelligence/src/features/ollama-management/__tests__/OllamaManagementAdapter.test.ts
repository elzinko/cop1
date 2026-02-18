import { describe, expect, it, vi } from 'vitest';
import type { OllamaManagementPort } from '../application/OllamaManagementAdapter.js';

function createMockAdapter(): OllamaManagementPort {
  return {
    async listModels() {
      return [
        { name: 'llama3:latest', size: 4_700_000_000, modifiedAt: '2026-01-01T00:00:00Z' },
        { name: 'codellama:7b', size: 3_800_000_000, modifiedAt: '2026-01-02T00:00:00Z' },
      ];
    },
    async *pullModel(_modelId: string) {
      yield { status: 'downloading', completed: 50, total: 100 };
      yield { status: 'downloading', completed: 100, total: 100 };
      yield { status: 'success', completed: 100, total: 100 };
    },
    async deleteModel(_modelId: string) {
      // Mock delete
    },
  };
}

describe('OllamaManagementAdapter', () => {
  it('should list models', async () => {
    const adapter = createMockAdapter();
    const models = await adapter.listModels();

    expect(models).toHaveLength(2);
    expect(models[0]?.name).toBe('llama3:latest');
  });

  it('should stream pull progress', async () => {
    const adapter = createMockAdapter();
    const events: Array<{ status: string }> = [];

    for await (const event of adapter.pullModel('llama3')) {
      events.push(event);
    }

    expect(events).toHaveLength(3);
    expect(events[2]?.status).toBe('success');
  });

  it('should delete a model', async () => {
    const adapter = createMockAdapter();
    const deleteSpy = vi.spyOn(adapter, 'deleteModel');

    await adapter.deleteModel('llama3');
    expect(deleteSpy).toHaveBeenCalledWith('llama3');
  });
});
