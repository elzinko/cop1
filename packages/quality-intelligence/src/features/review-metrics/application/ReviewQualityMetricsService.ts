import type { ReviewData, ReviewQualityMetrics } from '../domain/ReviewData.js';

export class ReviewQualityMetricsService {
  compute(reviews: ReviewData[]): ReviewQualityMetrics {
    const total = reviews.length;

    if (total === 0) {
      return {
        approvalRate: 0,
        reworkRate: 0,
        avgIterationsPerStory: 0,
        totalReviews: 0,
      };
    }

    const approvedCount = reviews.filter((r) => r.approved).length;
    const reworkCount = reviews.filter((r) => r.iterations > 1).length;
    const totalIterations = reviews.reduce((sum, r) => sum + r.iterations, 0);

    return {
      approvalRate: approvedCount / total,
      reworkRate: reworkCount / total,
      avgIterationsPerStory: totalIterations / total,
      totalReviews: total,
    };
  }
}
