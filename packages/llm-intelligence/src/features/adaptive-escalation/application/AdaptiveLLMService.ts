import type { EventBus } from '@cop1/shared-kernel';

export interface EscalationRecord {
  agentName: string;
  originalModel: string;
  fallbackModel: string;
  escalatedAt: string;
  reason: string;
}

export class AdaptiveLLMService {
  private failureCounts = new Map<string, number>();
  private escalations = new Map<string, EscalationRecord>();

  constructor(
    private readonly eventBus: EventBus,
    private readonly fallbackConfig: Record<string, string>,
    private readonly failureThreshold: number = 2,
  ) {}

  recordFailure(agentName: string, storyId: string): EscalationRecord | null {
    const key = `${agentName}:${storyId}`;
    const count = (this.failureCounts.get(key) ?? 0) + 1;
    this.failureCounts.set(key, count);

    if (count >= this.failureThreshold) {
      return this.escalate(agentName);
    }

    return null;
  }

  escalate(agentName: string): EscalationRecord | null {
    const fallbackModel = this.fallbackConfig[agentName];
    if (!fallbackModel) return null;

    const record: EscalationRecord = {
      agentName,
      originalModel: 'primary',
      fallbackModel,
      escalatedAt: new Date().toISOString(),
      reason: `${this.failureThreshold} consecutive failures`,
    };

    this.escalations.set(agentName, record);

    this.eventBus.emit('llm.escalated', {
      agentName,
      fallbackModel,
    });

    return record;
  }

  getActiveModel(agentName: string): string | null {
    const escalation = this.escalations.get(agentName);
    return escalation?.fallbackModel ?? null;
  }

  resetFailures(agentName: string, storyId: string): void {
    this.failureCounts.delete(`${agentName}:${storyId}`);
  }
}
