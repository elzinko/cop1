import type { RuleSet } from '../RuleSet.js';

/** Port for loading governance rules from storage. */
export interface RuleLoaderPort {
  /** Load all governance rules and return the complete rule set. */
  load(): RuleSet;
}
