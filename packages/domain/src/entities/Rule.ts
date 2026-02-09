/**
 * Rule entity - Business representation of a rule for agent behavior
 * PURE BUSINESS LOGIC - No infrastructure dependencies
 */

export enum RuleLevel {
  MUST = 'MUST',
  SHOULD = 'SHOULD',
  MAY = 'MAY',
}

export class Rule {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly level: RuleLevel,
    public readonly content: string,
  ) {}

  /**
   * Check if rule is mandatory
   */
  isMandatory(): boolean {
    return this.level === RuleLevel.MUST;
  }

  /**
   * Check if rule is recommended
   */
  isRecommended(): boolean {
    return this.level === RuleLevel.SHOULD;
  }

  /**
   * Check if rule is optional
   */
  isOptional(): boolean {
    return this.level === RuleLevel.MAY;
  }
}

export interface RuleModule {
  name: string;
  version: string;
  description: string;
  tags: string[];
  rules: Rule[];
}
