import { existsSync, watch } from 'node:fs';
import type { FSWatcher } from 'node:fs';
import { totalmem } from 'node:os';
import { join } from 'node:path';
import type { Cop1Config } from '@cop1/shared-kernel';
import { ConfigSchema } from '../domain/ConfigSchema.js';
import { ConfigValidationError } from '../domain/ConfigValidationError.js';
import { readYamlFile } from '../infrastructure/YamlFileReader.js';

const CONFIG_FILENAME = 'cop1.config.yaml';
const DEBOUNCE_MS = 500;

export class ConfigLoader {
  private config: Cop1Config | null = null;
  private watcher: FSWatcher | null = null;
  private skipRamValidation: boolean;

  constructor(options?: { skipRamValidation?: boolean }) {
    this.skipRamValidation = options?.skipRamValidation ?? false;
  }

  load(projectPath: string): Cop1Config {
    const configPath = join(projectPath, CONFIG_FILENAME);

    let raw: unknown = {};
    if (existsSync(configPath)) {
      raw = readYamlFile(configPath);
    }

    const result = ConfigSchema.safeParse(raw ?? {});
    if (!result.success) {
      const issue = result.error.issues[0];
      const field = issue ? issue.path.join('.') : 'unknown';
      const detail = issue ? issue.message : 'Unknown validation error';
      throw new ConfigValidationError(field, detail);
    }

    if (!this.skipRamValidation) {
      const totalGB = Math.round((totalmem() / 1e9) * 100) / 100;
      if (result.data.resources.ram_budget_night_gb > totalGB) {
        throw new ConfigValidationError(
          'resources.ram_budget_night_gb',
          `${result.data.resources.ram_budget_night_gb}GB exceeds total RAM (${totalGB}GB)`,
        );
      }
      if (result.data.resources.ram_budget_day_gb > totalGB) {
        throw new ConfigValidationError(
          'resources.ram_budget_day_gb',
          `${result.data.resources.ram_budget_day_gb}GB exceeds total RAM (${totalGB}GB)`,
        );
      }
    }

    this.config = result.data;
    return this.config;
  }

  get(): Cop1Config {
    if (!this.config) {
      throw new Error('Config not loaded. Call load() first.');
    }
    return this.config;
  }

  watch(projectPath: string, callback: (config: Cop1Config) => void): void {
    const configPath = join(projectPath, CONFIG_FILENAME);
    if (!existsSync(configPath)) {
      return;
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    this.watcher = watch(configPath, () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        try {
          const newConfig = this.load(projectPath);
          callback(newConfig);
        } catch {
          // Validation error on reload — keep previous config, don't crash
        }
      }, DEBOUNCE_MS);
    });
  }

  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}
