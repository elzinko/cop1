export interface SprintStatusReaderPort {
  getStoryStatus(storyId: string): string | null;
  getAllStatuses(): Map<string, string>;
}
