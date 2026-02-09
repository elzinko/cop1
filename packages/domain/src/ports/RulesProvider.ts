import type { RuleModule } from '../entities/Rule.js';

/**
 * Port (interface) for Rules provider
 * Loads and manages agent behavior rules
 */
export interface RulesProvider {
  /**
   * Load a rule module by name
   */
  loadModule(moduleName: string): Promise<RuleModule | null>;

  /**
   * Load multiple rule modules
   */
  loadModules(moduleNames: string[]): Promise<RuleModule[]>;

  /**
   * List all available rule modules
   */
  listAvailableModules(): Promise<string[]>;

  /**
   * Get rules as formatted text for LLM system prompt
   */
  formatRulesForLLM(moduleNames: string[]): Promise<string>;
}
