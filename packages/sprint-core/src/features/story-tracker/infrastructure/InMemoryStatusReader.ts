import type { SprintStatusReaderPort } from '../domain/ports/SprintStatusReaderPort.js';

export class InMemoryStatusReader implements SprintStatusReaderPort {
  private readonly statuses: Map<string, string>;

  constructor(initial?: Map<string, string>) {
    this.statuses = new Map(initial ?? []);
  }

  getStoryStatus(storyId: string): string | null {
    return this.statuses.get(storyId) ?? null;
  }

  getAllStatuses(): Map<string, string> {
    return new Map(this.statuses);
  }

  setStatus(storyId: string, status: string): void {
    this.statuses.set(storyId, status);
  }
}
