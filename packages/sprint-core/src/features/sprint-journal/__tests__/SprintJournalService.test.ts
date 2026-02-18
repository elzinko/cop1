import { beforeEach, describe, expect, it } from 'vitest';
import { SprintJournalService } from '../application/SprintJournalService.js';

describe('SprintJournalService', () => {
  let service: SprintJournalService;

  beforeEach(() => {
    service = new SprintJournalService();
  });

  it('should add a journal entry', () => {
    const entry = service.addEntry('sprint-1', 'Sprint Started', 'The team kicked off sprint 1.');

    expect(entry.sprintId).toBe('sprint-1');
    expect(entry.event).toBe('Sprint Started');
    expect(entry.narrative).toBe('The team kicked off sprint 1.');
    expect(entry.timestamp).toBeDefined();
  });

  it('should get entries for a sprint', () => {
    service.addEntry('sprint-1', 'Sprint Started', 'Kickoff');
    service.addEntry('sprint-1', 'Story Completed', 'E1-S1 done');
    service.addEntry('sprint-2', 'Sprint Started', 'Sprint 2 kickoff');

    const entries = service.getEntries('sprint-1');
    expect(entries).toHaveLength(2);
  });

  it('should generate a markdown narrative', () => {
    service.addEntry('sprint-1', 'Sprint Started', 'The team kicked off sprint 1.');
    service.addEntry('sprint-1', 'Blocage Resolved', 'The API key issue was fixed.');

    const narrative = service.generateNarrative('sprint-1');
    expect(narrative).toContain('# Sprint Journal: sprint-1');
    expect(narrative).toContain('## Sprint Started');
    expect(narrative).toContain('The team kicked off sprint 1.');
    expect(narrative).toContain('## Blocage Resolved');
    expect(narrative).toContain('The API key issue was fixed.');
  });

  it('should return header only for empty sprint', () => {
    const narrative = service.generateNarrative('sprint-99');
    expect(narrative).toBe('# Sprint Journal: sprint-99\n');
  });
});
