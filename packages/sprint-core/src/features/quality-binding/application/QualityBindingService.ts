import type { QualityToolBinding } from '../domain/QualityBindingTypes.js';

export class QualityBindingService {
  private readonly bindings = new Map<string, QualityToolBinding[]>();

  bind(ruleId: string, toolName: string, config: Record<string, unknown>): QualityToolBinding {
    const binding: QualityToolBinding = { ruleId, toolName, config };

    const existing = this.bindings.get(ruleId) ?? [];
    existing.push(binding);
    this.bindings.set(ruleId, existing);

    return binding;
  }

  getBindings(ruleId: string): QualityToolBinding[] {
    return this.bindings.get(ruleId) ?? [];
  }

  getByTool(toolName: string): QualityToolBinding[] {
    const result: QualityToolBinding[] = [];
    for (const bindings of this.bindings.values()) {
      for (const binding of bindings) {
        if (binding.toolName === toolName) {
          result.push(binding);
        }
      }
    }
    return result;
  }
}
