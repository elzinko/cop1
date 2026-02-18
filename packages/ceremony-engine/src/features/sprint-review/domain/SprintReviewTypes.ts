import type { RoundTableParticipant } from '../../round-table/domain/RoundTableTypes.js';

export interface SprintReviewInput {
  sprintId: string;
  deliveredStories: Array<{ id: string; title: string; points: number }>;
  qualityMetrics: {
    coveragePercent: number;
    gatesPassed: boolean;
    blocagesCount: number;
  };
}

export interface SprintReviewResult {
  summary: string;
  recommendations: string[];
  nextSprintFocus: string;
}

export interface ReviewParticipantPort {
  getParticipants(): RoundTableParticipant[];
}
