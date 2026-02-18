import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ModelState {
  model: string;
  status: 'downloading' | 'loaded' | 'stopped';
  sizeGB: number;
}

export interface OllamaManagementPort {
  pullModel(modelId: string): AsyncIterable<{ status: string; completed: number; total: number }>;
  loadModel(modelId: string): Promise<void>;
  unloadModel(modelId: string): Promise<void>;
}

export class ModelManager {
  private readonly modelsPath: string;

  constructor(
    projectPath: string,
    private readonly ollama: OllamaManagementPort,
  ) {
    this.modelsPath = join(projectPath, '.cop1/models.json');
  }

  async pull(
    modelId: string,
  ): Promise<AsyncIterable<{ status: string; completed: number; total: number }>> {
    this.updateState(modelId, 'downloading', 0);
    return this.ollama.pullModel(modelId);
  }

  async activate(modelId: string): Promise<void> {
    await this.ollama.loadModel(modelId);
    this.updateState(modelId, 'loaded', 0);
  }

  async deactivate(modelId: string): Promise<void> {
    await this.ollama.unloadModel(modelId);
    this.updateState(modelId, 'stopped', 0);
  }

  getStates(): ModelState[] {
    if (!existsSync(this.modelsPath)) return [];
    try {
      const content = readFileSync(this.modelsPath, 'utf-8');
      return (JSON.parse(content) as ModelState[]) ?? [];
    } catch {
      return [];
    }
  }

  private updateState(modelId: string, status: ModelState['status'], sizeGB: number): void {
    const states = this.getStates();
    const existing = states.findIndex((s) => s.model === modelId);

    const newState: ModelState = { model: modelId, status, sizeGB };
    if (existing >= 0) {
      states[existing] = newState;
    } else {
      states.push(newState);
    }

    writeFileSync(this.modelsPath, JSON.stringify(states, null, 2), 'utf-8');
  }
}
