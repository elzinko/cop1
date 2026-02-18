export interface ReviewResult {
  verdict: 'approve' | 'request-changes';
  comments: string[];
}

export class MaxRejectionsError extends Error {
  constructor(
    public readonly storyId: string,
    public readonly rejectionCount: number,
  ) {
    super(`Max rejections (${rejectionCount}) reached for story ${storyId}`);
    this.name = 'MaxRejectionsError';
  }
}
