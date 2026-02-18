import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

export class EnrichmentService {
  append(snapshotPath: string, section: string, content: string): void {
    this.safeAppend(snapshotPath, section, content);
  }

  safeAppend(snapshotPath: string, section: string, content: string): void {
    if (!existsSync(snapshotPath)) {
      throw new Error(`Snapshot not found: ${snapshotPath}`);
    }

    const existing = readFileSync(snapshotPath, 'utf-8');
    const sectionHeader = `\n## ${section}\n\n`;
    const updated = `${existing + sectionHeader + content}\n`;

    // Atomic write: write to .tmp then rename
    const tmpPath = `${snapshotPath}.tmp`;
    writeFileSync(tmpPath, updated, 'utf-8');
    renameSync(tmpPath, snapshotPath);
  }
}
