export interface ReviewData {
  storyId: string;
  approved: boolean;
  iterations: number;
}

export interface ReviewQualityMetrics {
  approvalRate: number;
  reworkRate: number;
  avgIterationsPerStory: number;
  totalReviews: number;
}
