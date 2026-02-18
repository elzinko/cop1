import type { StoryMetadata } from '../StoryMetadata.js';

export interface BMADReaderPort {
  listStories(projectPath: string): StoryMetadata[];
  verifyIntegrity(): void;
}
