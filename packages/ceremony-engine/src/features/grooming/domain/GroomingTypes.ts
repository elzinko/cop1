import type { RoundTableParticipant } from '../../round-table/domain/RoundTableTypes.js';

export interface GroomingInput {
  stories: Array<{
    id: string;
    title: string;
    acceptanceCriteria: string[];
  }>;
}

export interface RefinedStory {
  id: string;
  estimatedPoints: number;
  ready: boolean;
}

export interface GroomingResult {
  refinedStories: RefinedStory[];
}

export interface GroomingParticipantPort {
  getParticipants(): RoundTableParticipant[];
}
