import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export class SnapshotService {
  createSnapshot(storyId: string, sourceFilePath: string, projectPath: string): string {
    const content = readFileSync(sourceFilePath, 'utf-8');
    const checksum = createHash('sha256').update(content).digest('hex');
    const snapshotAt = new Date().toISOString();

    const header = [
      `<!-- snapshot_at: ${snapshotAt} -->`,
      `<!-- source_checksum: ${checksum} -->`,
      `<!-- story_id: ${storyId} -->`,
      '',
    ].join('\n');

    const snapshotDir = join(projectPath, '.cop1', 'stories');
    if (!existsSync(snapshotDir)) {
      mkdirSync(snapshotDir, { recursive: true });
    }

    const snapshotPath = join(snapshotDir, `${storyId}-snapshot.md`);
    writeFileSync(snapshotPath, header + content, 'utf-8');

    return snapshotPath;
  }

  getSnapshot(storyId: string, projectPath: string): string | null {
    const snapshotPath = join(projectPath, '.cop1', 'stories', `${storyId}-snapshot.md`);
    if (!existsSync(snapshotPath)) {
      return null;
    }
    return readFileSync(snapshotPath, 'utf-8');
  }

  getSnapshotPath(storyId: string, projectPath: string): string {
    return join(projectPath, '.cop1', 'stories', `${storyId}-snapshot.md`);
  }
}
