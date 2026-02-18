import { type StoryStatusValue, isValidTransition } from '../domain/StoryStatus.js';
import { InvalidTransitionError } from '../domain/errors/InvalidTransitionError.js';
import type { StatusEntry, YamlStatusStore } from '../infrastructure/YamlStatusStore.js';

export class StoryStatusTracker {
  constructor(private readonly store: YamlStatusStore) {}

  setStatus(storyId: string, newStatus: StoryStatusValue): void {
    const entries = this.store.readAll();
    const current = entries.get(storyId);
    const currentStatus = (current?.status ?? 'backlog') as StoryStatusValue;

    if (!isValidTransition(currentStatus, newStatus)) {
      throw new InvalidTransitionError(storyId, currentStatus, newStatus);
    }

    entries.set(storyId, {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });
    this.store.write(entries);
  }

  getStatus(storyId: string): StatusEntry | null {
    const entries = this.store.readAll();
    return entries.get(storyId) ?? null;
  }

  getAllStatuses(): Map<string, StatusEntry> {
    return this.store.readAll();
  }
}
