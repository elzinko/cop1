import type { RulesProvider, RuleModule as DomainRuleModule } from '@cop1/domain';
import { Rule as DomainRule, RuleLevel } from '@cop1/domain';
import {
  loadModules,
  formatModulesForLLM,
  listAllAvailableModules,
  type RuleModule as EngineRuleModule,
  type Rule as EngineRule,
} from '@cop1/rules-engine';

/**
 * Rules Provider Adapter
 * Adapts the rules-engine package to the domain's RulesProvider port
 * Converts rules-engine types to domain types
 */
export class RulesProviderAdapter implements RulesProvider {
  /**
   * Convert rules-engine Rule to domain Rule (class instance)
   */
  private convertRule(engineRule: EngineRule): DomainRule {
    return new DomainRule(
      engineRule.id,
      engineRule.title,
      engineRule.level as RuleLevel,
      engineRule.content,
    );
  }

  /**
   * Convert rules-engine RuleModule to domain RuleModule
   */
  private convertModule(engineModule: EngineRuleModule): DomainRuleModule {
    return {
      name: engineModule.name,
      version: engineModule.version,
      description: engineModule.description,
      tags: engineModule.tags,
      rules: engineModule.rules.map((r) => this.convertRule(r)),
    };
  }

  async loadModule(moduleName: string): Promise<DomainRuleModule | null> {
    const modules = loadModules([moduleName]);
    const engineModule = modules[0];
    return engineModule ? this.convertModule(engineModule) : null;
  }

  async loadModules(moduleNames: string[]): Promise<DomainRuleModule[]> {
    const engineModules = loadModules(moduleNames);
    return engineModules.map((m) => this.convertModule(m));
  }

  async listAvailableModules(): Promise<string[]> {
    return listAllAvailableModules();
  }

  async formatRulesForLLM(moduleNames: string[]): Promise<string> {
    // Use rules-engine formatter directly (doesn't need conversion)
    const engineModules = loadModules(moduleNames);
    return formatModulesForLLM(engineModules);
  }
}
