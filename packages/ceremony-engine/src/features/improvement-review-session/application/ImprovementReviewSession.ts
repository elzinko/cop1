import type { RoundTableEngine } from '../../round-table/application/RoundTableEngine.js';
import type {
  ImprovementReviewInput,
  ImprovementReviewParticipantPort,
  ImprovementReviewResult,
} from '../domain/ImprovementReviewTypes.js';

export class ImprovementReviewSession {
  constructor(
    private readonly roundTable: RoundTableEngine,
    private readonly participantPort: ImprovementReviewParticipantPort,
  ) {}

  async review(input: ImprovementReviewInput): Promise<ImprovementReviewResult> {
    const label =
      input.suggestion.type === 'architecture-rule'
        ? `architecture rule: "${input.suggestion.rule}"`
        : `refactoring story: "${input.suggestion.title}"`;

    const topic = `Re-analyze improvement suggestion (${label}). Context: ${input.context}`;

    const participants = this.participantPort.getParticipants();
    const result = await this.roundTable.run(topic, participants);

    const hasNeedsMoreInfo = result.contributions.some(
      (c) =>
        c.position.toLowerCase().includes('needs-more-info') ||
        c.position.toLowerCase().includes('needs more info'),
    );

    let verdict: ImprovementReviewResult['verdict'];
    if (hasNeedsMoreInfo) {
      verdict = 'needs-more-info';
    } else if (result.consensus) {
      verdict = 'approved';
    } else {
      verdict = 'rejected';
    }

    return {
      verdict,
      reasoning: result.synthesis,
      contributions: result.contributions,
    };
  }
}
