import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { StoryMetadata } from '../domain/StoryMetadata.js';
import { IntegrityError } from '../domain/errors/IntegrityError.js';
import type { BMADReaderPort } from '../domain/ports/BMADReaderPort.js';

const STORIES_DIR = '_bmad-output/planning-artifacts/stories';

export class BMADReader implements BMADReaderPort {
  private checksums: Map<string, { checksum: string; filePath: string }> = new Map();

  listStories(projectPath: string): StoryMetadata[] {
    const storiesRoot = join(projectPath, STORIES_DIR);
    if (!existsSync(storiesRoot)) {
      return [];
    }

    const stories: StoryMetadata[] = [];
    const sprintDirs = readdirSync(storiesRoot, { withFileTypes: true });

    for (const dir of sprintDirs) {
      if (!dir.isDirectory()) continue;
      const sprintPath = join(storiesRoot, dir.name);
      const files = readdirSync(sprintPath).filter((f) => f.endsWith('.md'));

      for (const file of files) {
        const filePath = join(sprintPath, file);
        const content = readFileSync(filePath, 'utf-8');
        const metadata = this.parseStoryMetadata(content, filePath, file);
        if (metadata) {
          stories.push(metadata);
          this.checksums.set(metadata.id, { checksum: metadata.checksum, filePath });
        }
      }
    }

    return stories;
  }

  verifyIntegrity(): void {
    for (const [storyId, { checksum, filePath }] of this.checksums) {
      const content = readFileSync(filePath, 'utf-8');
      const currentChecksum = this.computeChecksum(content);
      if (currentChecksum !== checksum) {
        throw new IntegrityError(storyId, checksum, currentChecksum);
      }
    }
  }

  private parseStoryMetadata(
    content: string,
    filePath: string,
    filename: string,
  ): StoryMetadata | null {
    // Extract title from first # heading
    const titleMatch = content.match(/^#\s+(?:Story\s+)?(.+)$/m);
    const title = titleMatch ? titleMatch[1]?.trim() : filename.replace('.md', '');

    // Extract status from "Status: <value>" line
    const statusMatch = content.match(/^Status:\s*(.+)$/m);
    const status = statusMatch ? statusMatch[1]?.trim() : 'unknown';

    // Extract ID from filename (e.g., E1-S1-monorepo-setup.md → E1-S1)
    const idMatch = filename.match(/^(E\d+-S\d+)/);
    const id = idMatch?.[1] ?? filename.replace('.md', '');

    const checksum = this.computeChecksum(content);

    return { id, title, status, filePath, checksum };
  }

  private computeChecksum(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
}
