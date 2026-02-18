import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigLoader } from '../application/ConfigLoader.js';
import { ConfigValidationError } from '../domain/ConfigValidationError.js';

describe('ConfigLoader', () => {
  let testDir: string;
  let loader: ConfigLoader;

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `cop1-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(testDir, { recursive: true });
    loader = new ConfigLoader({ skipRamValidation: true });
  });

  afterEach(() => {
    loader.stopWatching();
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should load default config when no file exists', () => {
    const config = loader.load(testDir);

    expect(config.project.name).toBe('cop1-project');
    expect(config.daemon.port).toBe(4242);
    expect(config.sprint.default_duration_hours).toBe(8);
    expect(config.resources.ram_budget_night_gb).toBe(48);
    expect(config.resources.ram_budget_day_gb).toBe(20);
    expect(config.llm_routing).toEqual({});
    expect(config.schedule.auto_start).toEqual([]);
  });

  it('should load config from yaml file', () => {
    const yaml = `
project:
  name: my-project
  path: /tmp/my-project
daemon:
  port: 5000
sprint:
  default_duration_hours: 4
resources:
  ram_budget_night_gb: 32
  ram_budget_day_gb: 16
llm_routing:
  default: ollama/llama3
  code: ollama/codellama
  review: ollama/llama3
schedule:
  auto_start:
    - "22:00"
`;
    writeFileSync(join(testDir, 'cop1.config.yaml'), yaml);

    const config = loader.load(testDir);

    expect(config.project.name).toBe('my-project');
    expect(config.project.path).toBe('/tmp/my-project');
    expect(config.daemon.port).toBe(5000);
    expect(config.sprint.default_duration_hours).toBe(4);
    expect(config.resources.ram_budget_night_gb).toBe(32);
    expect(config.resources.ram_budget_day_gb).toBe(16);
    expect(config.llm_routing.code).toBe('ollama/codellama');
    expect(config.schedule.auto_start).toEqual(['22:00']);
  });

  it('should throw ConfigValidationError for invalid config', () => {
    const yaml = `
resources:
  ram_budget_night_gb: 2
`;
    writeFileSync(join(testDir, 'cop1.config.yaml'), yaml);

    expect(() => loader.load(testDir)).toThrow(ConfigValidationError);
  });

  it('should apply defaults for missing optional sections', () => {
    const yaml = `
project:
  name: minimal
  path: .
`;
    writeFileSync(join(testDir, 'cop1.config.yaml'), yaml);

    const config = loader.load(testDir);
    expect(config.project.name).toBe('minimal');
    expect(config.daemon.port).toBe(4242);
    expect(config.resources.ram_budget_night_gb).toBe(48);
  });

  it('should return loaded config via get()', () => {
    loader.load(testDir);
    const config = loader.get();
    expect(config.daemon.port).toBe(4242);
  });

  it('should throw when calling get() before load()', () => {
    expect(() => loader.get()).toThrow('Config not loaded');
  });

  it('should detect file changes via watch and reload config', async () => {
    const yaml = `
project:
  name: before
  path: .
`;
    const configPath = join(testDir, 'cop1.config.yaml');
    writeFileSync(configPath, yaml);
    loader.load(testDir);

    const reloaded = vi.fn();
    loader.watch(testDir, reloaded);

    // Small delay to let watcher initialize, then modify
    await new Promise((r) => setTimeout(r, 100));

    const updatedYaml = `
project:
  name: after
  path: .
`;
    writeFileSync(configPath, updatedYaml);

    // Poll for callback (fs.watch timing varies by OS)
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && !reloaded.mock.calls.length) {
      await new Promise((r) => setTimeout(r, 200));
    }

    expect(reloaded).toHaveBeenCalled();
    const newConfig = reloaded.mock.calls[0]?.[0] as { project: { name: string } };
    expect(newConfig.project.name).toBe('after');
  });

  it('should keep previous config on reload with invalid yaml', async () => {
    const yaml = `
project:
  name: valid
  path: .
`;
    const configPath = join(testDir, 'cop1.config.yaml');
    writeFileSync(configPath, yaml);
    loader.load(testDir);

    const reloaded = vi.fn();
    loader.watch(testDir, reloaded);

    await new Promise((r) => setTimeout(r, 100));

    // Write invalid config
    writeFileSync(configPath, '\nresources:\n  ram_budget_night_gb: 1\n');

    // Wait enough for debounce + fs.watch to fire
    await new Promise((r) => setTimeout(r, 2000));

    // Callback should NOT have been called (validation failed)
    expect(reloaded).not.toHaveBeenCalled();
    // Previous config still accessible
    expect(loader.get().project.name).toBe('valid');
  });

  it('should reject ram_budget exceeding system RAM', () => {
    const yaml = `
resources:
  ram_budget_night_gb: 99999
`;
    writeFileSync(join(testDir, 'cop1.config.yaml'), yaml);

    const strictLoader = new ConfigLoader({ skipRamValidation: false });
    expect(() => strictLoader.load(testDir)).toThrow(ConfigValidationError);
  });

  it('should require llm_routing.default when llm_routing has entries', () => {
    const yaml = `
llm_routing:
  dev: mistral:7b
`;
    writeFileSync(join(testDir, 'cop1.config.yaml'), yaml);

    expect(() => loader.load(testDir)).toThrow(ConfigValidationError);
  });

  it('should accept llm_routing with a default key', () => {
    const yaml = `
llm_routing:
  dev: mistral:7b
  default: llama3:8b
`;
    writeFileSync(join(testDir, 'cop1.config.yaml'), yaml);

    const config = loader.load(testDir);
    expect(config.llm_routing.dev).toBe('mistral:7b');
    expect(config.llm_routing.default).toBe('llama3:8b');
  });

  it('should include llm_fallback in config', () => {
    const yaml = `
llm_routing:
  default: llama3:8b
llm_fallback:
  dev: backup-model
`;
    writeFileSync(join(testDir, 'cop1.config.yaml'), yaml);

    const config = loader.load(testDir);
    expect(config.llm_fallback.dev).toBe('backup-model');
  });
});
