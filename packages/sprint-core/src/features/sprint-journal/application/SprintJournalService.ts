export interface JournalEntry {
  sprintId: string;
  event: string;
  narrative: string;
  timestamp: string;
}

export class SprintJournalService {
  private readonly entries = new Map<string, JournalEntry[]>();

  addEntry(sprintId: string, event: string, narrative: string): JournalEntry {
    const entry: JournalEntry = {
      sprintId,
      event,
      narrative,
      timestamp: new Date().toISOString(),
    };

    const existing = this.entries.get(sprintId) ?? [];
    existing.push(entry);
    this.entries.set(sprintId, existing);

    return entry;
  }

  getEntries(sprintId: string): JournalEntry[] {
    return this.entries.get(sprintId) ?? [];
  }

  generateNarrative(sprintId: string): string {
    const entries = this.getEntries(sprintId);
    const lines: string[] = [`# Sprint Journal: ${sprintId}`, ''];

    if (entries.length === 0) {
      return lines.join('\n');
    }

    for (const entry of entries) {
      lines.push(`## ${entry.event}`);
      lines.push('');
      lines.push(entry.narrative);
      lines.push('');
    }

    return lines.join('\n');
  }
}
