import type { RuleModule, Rule } from './types.js';

/**
 * Rules Engine Validator
 * Validates rule modules for correctness
 */

export interface ValidationError {
  field: string;
  message: string;
}

const VALID_RULE_LEVELS = ['MUST', 'SHOULD', 'MAY'] as const;

/**
 * Validate a single rule
 */
export function validateRule(rule: Rule, index: number): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!rule.id || typeof rule.id !== 'string') {
    errors.push({
      field: `rules[${index}].id`,
      message: 'Rule ID is required and must be a string',
    });
  }

  if (!rule.title || typeof rule.title !== 'string') {
    errors.push({
      field: `rules[${index}].title`,
      message: 'Rule title is required and must be a string',
    });
  }

  if (!rule.level || !VALID_RULE_LEVELS.includes(rule.level)) {
    errors.push({
      field: `rules[${index}].level`,
      message: `Rule level must be one of: ${VALID_RULE_LEVELS.join(', ')}`,
    });
  }

  if (!rule.content || typeof rule.content !== 'string') {
    errors.push({
      field: `rules[${index}].content`,
      message: 'Rule content is required and must be a string',
    });
  }

  return errors;
}

/**
 * Validate a rule module
 */
export function validateModule(module: RuleModule): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!module.name || typeof module.name !== 'string') {
    errors.push({
      field: 'name',
      message: 'Module name is required and must be a string',
    });
  }

  if (!module.version || typeof module.version !== 'string') {
    errors.push({
      field: 'version',
      message: 'Module version is required and must be a string',
    });
  }

  if (!module.description || typeof module.description !== 'string') {
    errors.push({
      field: 'description',
      message: 'Module description is required and must be a string',
    });
  }

  if (!Array.isArray(module.tags)) {
    errors.push({
      field: 'tags',
      message: 'Module tags must be an array',
    });
  }

  if (!Array.isArray(module.rules)) {
    errors.push({
      field: 'rules',
      message: 'Module rules must be an array',
    });
  } else {
    // Validate each rule
    module.rules.forEach((rule, index) => {
      const ruleErrors = validateRule(rule, index);
      errors.push(...ruleErrors);
    });

    // Check for duplicate rule IDs
    const ruleIds = module.rules.map((r) => r.id);
    const duplicates = ruleIds.filter((id, index) => ruleIds.indexOf(id) !== index);
    if (duplicates.length > 0) {
      errors.push({
        field: 'rules',
        message: `Duplicate rule IDs found: ${duplicates.join(', ')}`,
      });
    }
  }

  return errors;
}

/**
 * Check if a module is valid
 */
export function isModuleValid(module: RuleModule): boolean {
  return validateModule(module).length === 0;
}
