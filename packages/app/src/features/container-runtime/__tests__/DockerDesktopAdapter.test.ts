import { describe, expect, it } from 'vitest';
import type {
  ContainerRuntimePort,
  ContainerStatus,
} from '../domain/ports/ContainerRuntimePort.js';

function createMockAdapter(): ContainerRuntimePort {
  const containers = new Map<string, ContainerStatus>([
    [
      'ollama-1',
      {
        id: 'ollama-1',
        name: 'ollama',
        state: 'stopped',
        image: 'ollama/ollama:latest',
      },
    ],
  ]);

  return {
    async startContainer(id: string) {
      const c = containers.get(id);
      if (c) containers.set(id, { ...c, state: 'running' });
    },
    async stopContainer(id: string) {
      const c = containers.get(id);
      if (c) containers.set(id, { ...c, state: 'stopped' });
    },
    async getStatus(id: string) {
      const c = containers.get(id);
      if (!c) throw new Error(`Container not found: ${id}`);
      return c;
    },
  };
}

describe('DockerDesktopAdapter (mock)', () => {
  it('should start a container', async () => {
    const adapter = createMockAdapter();
    await adapter.startContainer('ollama-1');
    const status = await adapter.getStatus('ollama-1');
    expect(status.state).toBe('running');
  });

  it('should stop a container', async () => {
    const adapter = createMockAdapter();
    await adapter.startContainer('ollama-1');
    await adapter.stopContainer('ollama-1');
    const status = await adapter.getStatus('ollama-1');
    expect(status.state).toBe('stopped');
  });

  it('should get container status', async () => {
    const adapter = createMockAdapter();
    const status = await adapter.getStatus('ollama-1');
    expect(status.name).toBe('ollama');
    expect(status.image).toBe('ollama/ollama:latest');
  });

  it('should throw for unknown container', async () => {
    const adapter = createMockAdapter();
    await expect(adapter.getStatus('unknown')).rejects.toThrow('Container not found');
  });
});
