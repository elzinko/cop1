import type { RulesProvider } from '@cop1/domain';
import { loadModules, formatModulesForLLM, listAllAvailableModules } from '@cop1/rules-engine';
import type { RuleModule } from '@cop1/domain';

/**
 * Rules Provider Adapter
 * Adapts the rules-engine package to the domain's RulesProvider port
 */
export class RulesProviderAdapter implements RulesProvider {
  async loadModule(moduleName: string): Promise<RuleModule | null> {
    const modules = loadModules([moduleName]);
    return modules[0] ?? null;
  }

  async loadModules(moduleNames: string[]): Promise<RuleModule[]> {
    return loadModules(moduleNames);
  }

  async listAvailableModules(): Promise<string[]> {
    return listAllAvailableModules();
  }

  async formatRulesForLLM(moduleNames: string[]): Promise<string> {
    const modules = await this.loadModules(moduleNames);
    return formatModulesForLLM(modules);
  }
}
