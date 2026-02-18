import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { StoryDecision } from '../domain/StoryDecision.js';

export class DecisionHistoryService {
  getAll(decisionsDir: string): StoryDecision[] {
    if (!existsSync(decisionsDir)) {
      return [];
    }

    const files = readdirSync(decisionsDir).filter(
      (f) => f.endsWith('.yaml') || f.endsWith('.yml'),
    );
    const decisions: StoryDecision[] = [];

    for (const file of files) {
      const content = readFileSync(join(decisionsDir, file), 'utf-8');
      const data = parse(content) as Record<string, unknown>;

      if (data && typeof data === 'object') {
        decisions.push({
          storyId: String(data.storyId ?? ''),
          question: String(data.question ?? ''),
          context: String(data.context ?? ''),
          status: String(data.status ?? ''),
          answer: data.answer != null ? String(data.answer) : undefined,
          asked_at: String(data.asked_at ?? ''),
        });
      }
    }

    return decisions;
  }

  getByStory(decisionsDir: string, storyId: string): StoryDecision[] {
    return this.getAll(decisionsDir).filter((d) => d.storyId === storyId);
  }
}
