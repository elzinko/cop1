import type { ReviewResult } from '../ReviewResult.js';

export interface ReviewerPort {
  review(qualityReport: string): Promise<ReviewResult>;
}
