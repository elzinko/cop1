import { beforeEach, describe, expect, it } from 'vitest';
import { QualityBindingService } from '../application/QualityBindingService.js';

describe('QualityBindingService', () => {
  let service: QualityBindingService;

  beforeEach(() => {
    service = new QualityBindingService();
  });

  it('should bind a tool to a rule', () => {
    const binding = service.bind('RULE-001', 'eslint', { rule: 'no-console' });

    expect(binding.ruleId).toBe('RULE-001');
    expect(binding.toolName).toBe('eslint');
    expect(binding.config).toEqual({ rule: 'no-console' });
  });

  it('should get bindings by rule id', () => {
    service.bind('RULE-001', 'eslint', { rule: 'no-console' });
    service.bind('RULE-002', 'prettier', { semi: true });

    const bindings = service.getBindings('RULE-001');
    expect(bindings).toHaveLength(1);
    expect(bindings[0]?.toolName).toBe('eslint');
  });

  it('should get bindings by tool name', () => {
    service.bind('RULE-001', 'eslint', { rule: 'no-console' });
    service.bind('RULE-002', 'eslint', { rule: 'no-unused-vars' });
    service.bind('RULE-003', 'prettier', { semi: true });

    const eslintBindings = service.getByTool('eslint');
    expect(eslintBindings).toHaveLength(2);
  });

  it('should support multiple bindings per rule', () => {
    service.bind('RULE-001', 'eslint', { rule: 'no-console' });
    service.bind('RULE-001', 'prettier', { semi: true });

    const bindings = service.getBindings('RULE-001');
    expect(bindings).toHaveLength(2);
    expect(bindings.map((b) => b.toolName)).toContain('eslint');
    expect(bindings.map((b) => b.toolName)).toContain('prettier');
  });
});
