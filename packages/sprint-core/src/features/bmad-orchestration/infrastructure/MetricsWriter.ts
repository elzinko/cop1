import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { MetricRecord } from '../domain/HistoryRecords.js';

/**
 * Writes Track 3 metrics JSONL files per ADR-014 §8.5.
 *
 * Path: `.cop1/metrics/YYYY-MM-DD.jsonl` — daily rotation by local date.
 * Each record is a single newline-terminated JSON object. Appends only.
 *
 * The `.cop1/metrics/` directory is gitignored (see `GitignoreBootstrap`).
 */
export class MetricsWriter {
  constructor(private readonly projectRoot: string) {}

  async append(record: MetricRecord): Promise<void> {
    const dir = join(this.projectRoot, '.cop1', 'metrics');
    await mkdir(dir, { recursive: true });
    const file = join(dir, `${this.datePart(record.ts)}.jsonl`);
    const line = `${JSON.stringify(record)}\n`;
    await appendFile(file, line, 'utf-8');
  }

  private datePart(ts: string): string {
    // Accept ISO-8601 or local date; take first 10 chars that look like YYYY-MM-DD.
    const match = ts.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
    return new Date().toISOString().slice(0, 10);
  }
}
