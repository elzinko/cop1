import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { StoryMetadata } from '../domain/StoryMetadata.js';
import { IntegrityError } from '../domain/errors/IntegrityError.js';
import type { BMADReaderPort } from '../domain/ports/BMADReaderPort.js';

// BMAD standard layout: stories live flat under implementation_artifacts.
// Confirmed by _bmad/bmm/config.yaml + create-story workflow.yaml (story_dir).
const STORIES_DIR = '_bmad-output/implementation-artifacts';

export class BMADReader implements BMADReaderPort {
  private checksums: Map<string, { checksum: string; filePath: string }> = new Map();

  listStories(projectPath: string): StoryMetadata[] {
    const storiesRoot = join(projectPath, STORIES_DIR);
    if (!existsSync(storiesRoot)) {
      return [];
    }

    const stories: StoryMetadata[] = [];
    const entries = readdirSync(storiesRoot, { withFileTypes: true });

    // Stories are .md files at the root of implementation-artifacts.
    // Skip directories, sprint-status.yaml, and any non-story markdown
    // (project-context.md, retros, SCPs, etc.) by matching the story filename
    // pattern in parseStoryMetadata.
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.md')) continue;
      const filePath = join(storiesRoot, entry.name);
      const content = readFileSync(filePath, 'utf-8');
      const metadata = this.parseStoryMetadata(content, filePath, entry.name);
      if (metadata) {
        stories.push(metadata);
        this.checksums.set(metadata.id, { checksum: metadata.checksum, filePath });
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
    const title = titleMatch?.[1]?.trim() ?? filename.replace('.md', '');

    // Extract status from "Status: <value>" line
    const statusMatch = content.match(/^Status:\s*(.+)$/m);
    const status = statusMatch?.[1]?.trim() ?? 'unknown';

    // Extract ID from filename. Supports both Phase 1 (E1-S1, E10-S9) and
    // Phase A (EA1-S1, EA9-S6, EA2-S0b) story IDs. Files that don't match
    // the story-ID pattern (e.g. project-context.md, retros, SCPs) are
    // filtered out by returning null.
    const idMatch = filename.match(/^(E[A]?\d+-S\d+[a-z]?)/);
    if (!idMatch) {
      return null;
    }
    const id = idMatch[1] as string;

    const checksum = this.computeChecksum(content);

    return { id, title, status, filePath, checksum };
  }

  private computeChecksum(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
}
