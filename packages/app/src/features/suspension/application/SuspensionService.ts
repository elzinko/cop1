import type { EventBus, ResourceSnapshot } from '@cop1/shared-kernel';
import type { CheckpointService } from '@cop1/sprint-core';
import type { CheckpointState } from '@cop1/sprint-core';
import { CheckpointPhase } from '@cop1/sprint-core';

export class SuspensionService {
  private suspended = false;
  private readonly suspendThreshold: number;
  private readonly resumeThreshold: number;

  constructor(
    private readonly eventBus: EventBus,
    private readonly checkpointService: CheckpointService,
    options?: { suspendThreshold?: number; resumeThreshold?: number },
  ) {
    this.suspendThreshold = options?.suspendThreshold ?? 75;
    this.resumeThreshold = options?.resumeThreshold ?? 70;
  }

  evaluate(snapshot: ResourceSnapshot): 'suspend' | 'resume' | 'noop' {
    if (!this.suspended && snapshot.ramPercent >= this.suspendThreshold) {
      this.suspend(snapshot);
      return 'suspend';
    }

    if (this.suspended && snapshot.ramPercent < this.resumeThreshold) {
      this.resume();
      return 'resume';
    }

    return 'noop';
  }

  private suspend(snapshot: ResourceSnapshot): void {
    this.suspended = true;

    const checkpoint: CheckpointState = {
      storyId: 'suspended',
      agentName: 'system',
      stepIndex: 0,
      stepName: 'resource-suspension',
      timestamp: new Date().toISOString(),
      phase: CheckpointPhase.AGENT_STARTED,
    };
    this.checkpointService.save(checkpoint);

    this.eventBus.emit('system.suspended', {
      reason: 'ram_threshold',
      ramPercent: snapshot.ramPercent,
      threshold: this.suspendThreshold,
    });
  }

  private resume(): void {
    this.suspended = false;

    this.eventBus.emit('system.resumed', {
      reason: 'ram_below_threshold',
      threshold: this.resumeThreshold,
    });
  }

  get isSuspended(): boolean {
    return this.suspended;
  }
}
