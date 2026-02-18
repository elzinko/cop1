import type { EventBus } from '@cop1/shared-kernel';

export class DoDLimiter {
  private rejectionCounts = new Map<string, number>();

  constructor(
    private readonly eventBus: EventBus,
    private readonly maxRejections: number = 3,
  ) {}

  check(storyId: string): { exceeded: boolean; count: number } {
    const count = (this.rejectionCounts.get(storyId) ?? 0) + 1;
    this.rejectionCounts.set(storyId, count);

    if (count >= this.maxRejections) {
      this.eventBus.emit('dod.max_rejections', {
        storyId,
        count,
        maxRejections: this.maxRejections,
      });
      return { exceeded: true, count };
    }

    return { exceeded: false, count };
  }

  getCount(storyId: string): number {
    return this.rejectionCounts.get(storyId) ?? 0;
  }

  reset(storyId: string): void {
    this.rejectionCounts.delete(storyId);
  }
}
