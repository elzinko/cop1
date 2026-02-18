import type { ImprovementProposal } from '../../retrospective/domain/RetroTypes.js';
import type {
  Contribution,
  RoundTableParticipant,
} from '../../round-table/domain/RoundTableTypes.js';

export interface ImprovementReviewInput {
  suggestion: ImprovementProposal;
  context: string;
}

export type ImprovementVerdict = 'approved' | 'rejected' | 'needs-more-info';

export interface ImprovementReviewResult {
  verdict: ImprovementVerdict;
  reasoning: string;
  contributions: Contribution[];
}

export interface ImprovementReviewParticipantPort {
  getParticipants(): RoundTableParticipant[];
}
