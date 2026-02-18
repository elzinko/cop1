import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { OllamaManagementPort } from '../application/ModelManager.js';
import { ModelManager } from '../application/ModelManager.js';

function createMockOllama(): OllamaManagementPort {
  return {
    async *pullModel() {
      yield { status: 'downloading', completed: 50, total: 100 };
      yield { status: 'done', completed: 100, total: 100 };
    },
    async loadModel() {},
    async unloadModel() {},
  };
}

describe('ModelManager', () => {
  let testDir: string;
  let manager: ModelManager;

  beforeEach(() => {
    testDir = join(tmpdir(), `cop1-mm-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(testDir, '.cop1'), { recursive: true });
    manager = new ModelManager(testDir, createMockOllama());
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should pull a model and track state', async () => {
    const stream = await manager.pull('llama3');
    const events: Array<{ status: string }> = [];
    for await (const event of stream) {
      events.push(event);
    }

    expect(events.length).toBeGreaterThan(0);
    const states = manager.getStates();
    expect(states.find((s) => s.model === 'llama3')?.status).toBe('downloading');
  });

  it('should activate a model', async () => {
    await manager.activate('llama3');
    const states = manager.getStates();
    expect(states.find((s) => s.model === 'llama3')?.status).toBe('loaded');
  });

  it('should deactivate a model', async () => {
    await manager.activate('llama3');
    await manager.deactivate('llama3');
    const states = manager.getStates();
    expect(states.find((s) => s.model === 'llama3')?.status).toBe('stopped');
  });

  it('should return empty states initially', () => {
    expect(manager.getStates()).toHaveLength(0);
  });
});
