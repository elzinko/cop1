import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import type { RuleModule, RuleModuleWithSource, ModuleSource } from './types.js';

/**
 * Rules Engine Loader
 * Loads rule modules from YAML files
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Get path for core rulesets (bundled with the package)
 */
export function getCoreRulesetsPath(): string {
  return resolve(__dirname, '../rulesets');
}

/**
 * Get path for custom rulesets (user-defined)
 */
export function getCustomRulesetsPath(): string {
  // In production, this would be configurable
  // For now, use a default location
  return resolve(process.cwd(), '.cop1/rulesets');
}

/**
 * Get source path based on source type
 */
export function getSourcePath(source: ModuleSource): string {
  return source === 'core' ? getCoreRulesetsPath() : getCustomRulesetsPath();
}

/**
 * Load a single rule module by name
 */
export function loadModule(
  name: string,
  source: ModuleSource = 'core',
): RuleModuleWithSource | null {
  const sourcePath = getSourcePath(source);
  const modulePath = resolve(sourcePath, name, 'ruleset.yaml');

  if (!existsSync(modulePath)) {
    return null;
  }

  try {
    const content = readFileSync(modulePath, 'utf-8');
    const parsed = parseYaml(content) as RuleModule;
    return { ...parsed, source };
  } catch (error) {
    console.error(`Failed to load module ${name}:`, error);
    return null;
  }
}

/**
 * Load multiple rule modules
 */
export function loadModules(names: string[]): RuleModuleWithSource[] {
  const modules: RuleModuleWithSource[] = [];

  for (const name of names) {
    // Try core first, then custom
    let module = loadModule(name, 'core');
    if (!module) {
      module = loadModule(name, 'custom');
    }

    if (module) {
      modules.push(module);
    } else {
      console.warn(`Rule module "${name}" not found`);
    }
  }

  return modules;
}

/**
 * List all available rule modules from a source
 */
export function listAvailableModules(source: ModuleSource): string[] {
  const sourcePath = getSourcePath(source);

  if (!existsSync(sourcePath)) {
    return [];
  }

  try {
    const dirs = readdirSync(sourcePath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    // Verify each directory has a ruleset.yaml
    return dirs.filter((dir) => {
      const rulesetPath = resolve(sourcePath, dir, 'ruleset.yaml');
      return existsSync(rulesetPath);
    });
  } catch {
    return [];
  }
}

/**
 * List all available modules (core + custom)
 */
export function listAllAvailableModules(): string[] {
  const coreModules = listAvailableModules('core');
  const customModules = listAvailableModules('custom');

  // Merge and dedupe (custom overrides core if same name)
  return Array.from(new Set([...coreModules, ...customModules]));
}
