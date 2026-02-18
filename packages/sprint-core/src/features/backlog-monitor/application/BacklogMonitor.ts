import type { EventBus } from '@cop1/shared-kernel';
import type { BacklogPort } from '../../pm-agent/domain/ports/BacklogPort.js';

export interface ReadinessResult {
  sufficient: boolean;
  readyCount: number;
  requiredCount: number;
}

export class BacklogMonitor {
  constructor(
    private readonly backlog: BacklogPort,
    private readonly eventBus: EventBus,
    private readonly minSprintCoverage: number = 5,
  ) {}

  checkReadiness(): ReadinessResult {
    const stories = this.backlog.getStories();
    const readyCount = stories.filter((s) => s.status === 'ready').length;
    const sufficient = readyCount >= this.minSprintCoverage;

    if (!sufficient) {
      this.eventBus.emit('backlog.insufficient_coverage', {
        readyCount,
        requiredCount: this.minSprintCoverage,
      });
    }

    return { sufficient, readyCount, requiredCount: this.minSprintCoverage };
  }
}
