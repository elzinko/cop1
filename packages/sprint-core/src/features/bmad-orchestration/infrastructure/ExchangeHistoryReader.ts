import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ExchangeFrontMatter } from '../domain/HistoryRecords.js';

export interface ExchangeFile {
  path: string;
  frontMatter: ExchangeFrontMatter;
  body: string;
}

/**
 * Reads Track 2 exchange markdown files written by `ExchangeHistoryWriter`
 * (EA11-S8 / ADR-014 §8.5). Consumed by the session transcript generator
 * (EA11-S7).
 */
export class ExchangeHistoryReader {
  constructor(private readonly projectRoot: string) {}

  async bySession(sessionId: string): Promise<ExchangeFile[]> {
    const all = await this.listAll();
    return all.filter((f) => f.frontMatter.sessionId === sessionId);
  }

  async byStory(storyId: string): Promise<ExchangeFile[]> {
    const all = await this.listAll();
    return all.filter((f) => f.frontMatter.storyId === storyId);
  }

  async listAll(): Promise<ExchangeFile[]> {
    const root = join(this.projectRoot, '.cop1', 'history');
    const files = await this.collectMarkdown(root);
    const parsed: ExchangeFile[] = [];
    for (const path of files) {
      try {
        const raw = await readFile(path, 'utf-8');
        const parsedFile = this.parse(path, raw);
        if (parsedFile) parsed.push(parsedFile);
      } catch {
        // Skip unreadable files
      }
    }
    parsed.sort((a, b) => a.frontMatter.startedAt.localeCompare(b.frontMatter.startedAt));
    return parsed;
  }

  private async collectMarkdown(dir: string): Promise<string[]> {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return [];
    }
    const results: string[] = [];
    for (const entry of entries) {
      const full = join(dir, entry);
      if (entry.endsWith('.md')) {
        results.push(full);
        continue;
      }
      // Recurse into subdirs (sprintId/storyId nesting)
      try {
        const nested = await this.collectMarkdown(full);
        results.push(...nested);
      } catch {
        // not a directory, skip
      }
    }
    return results;
  }

  private parse(path: string, raw: string): ExchangeFile | null {
    if (!raw.startsWith('---\n')) return null;
    const endIdx = raw.indexOf('\n---\n', 4);
    if (endIdx === -1) return null;
    const yaml = raw.slice(4, endIdx);
    const body = raw.slice(endIdx + 5).replace(/^<!-- cop1:body-start -->\n?/, '');

    const fm: Partial<ExchangeFrontMatter> = {};
    for (const line of yaml.split('\n')) {
      const m = line.match(/^([a-z_]+):\s*(.*)$/);
      if (!m) continue;
      const [, key, rawValue] = m;
      const value = this.parseValue(rawValue ?? '');
      switch (key) {
        case 'session_id':
          fm.sessionId = String(value);
          break;
        case 'story_id':
          fm.storyId = String(value);
          break;
        case 'sprint_id':
          fm.sprintId = String(value);
          break;
        case 'command':
          fm.command = String(value);
          break;
        case 'started_at':
          fm.startedAt = String(value);
          break;
        case 'ended_at':
          fm.endedAt = String(value);
          break;
        case 'supervisor_turns':
          fm.supervisorTurns = Number(value);
          break;
        case 'status':
          fm.status = value as ExchangeFrontMatter['status'];
          break;
      }
    }

    if (!fm.sessionId || !fm.storyId || !fm.startedAt) return null;

    return {
      path,
      frontMatter: {
        sessionId: fm.sessionId,
        storyId: fm.storyId,
        sprintId: fm.sprintId ?? '',
        command: fm.command ?? '',
        startedAt: fm.startedAt,
        endedAt: fm.endedAt ?? fm.startedAt,
        supervisorTurns: fm.supervisorTurns ?? 0,
        status: fm.status ?? 'success',
      },
      body,
    };
  }

  private parseValue(raw: string): string | number {
    const trimmed = raw.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      try {
        return JSON.parse(trimmed) as string;
      } catch {
        return trimmed.slice(1, -1);
      }
    }
    return trimmed;
  }
}
