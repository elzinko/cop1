import { existsSync, readFileSync } from 'node:fs';
import type { LogEntry } from '../../logger/application/StructuredLogger.js';

export class JSONLReader {
  read(filePath: string): LogEntry[] {
    if (!existsSync(filePath)) {
      return [];
    }

    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    return lines.map((line) => JSON.parse(line) as LogEntry);
  }
}
