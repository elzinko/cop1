/**
 * Minimal in-memory status reader. Kept after EA12-S4 for tests that want
 * a trivial status source without seeding a real YAML file. Exports its
 * own structural shape — consumers that also type against the new
 * `SprintStatusPort` (in `@cop1/app`) should be compatible since the
 * signature matches.
 */
export interface InMemoryStatusReaderShape {
  getStoryStatus(storyId: string): string | null;
  getAllStatuses(): Map<string, string>;
}

export class InMemoryStatusReader implements InMemoryStatusReaderShape {
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
