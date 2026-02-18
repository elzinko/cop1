import type { RoundTableEngine } from '../../round-table/application/RoundTableEngine.js';
import type {
  ReviewParticipantPort,
  SprintReviewInput,
  SprintReviewResult,
} from '../domain/SprintReviewTypes.js';

export class SprintReviewCeremony {
  constructor(
    private readonly roundTable: RoundTableEngine,
    private readonly participantPort: ReviewParticipantPort,
  ) {}

  async run(input: SprintReviewInput): Promise<SprintReviewResult> {
    const { sprintId, deliveredStories, qualityMetrics } = input;

    if (deliveredStories.length === 0) {
      return {
        summary: `Sprint ${sprintId} review: no stories delivered.`,
        recommendations: [],
        nextSprintFocus: 'Improve delivery throughput',
      };
    }

    const totalPoints = deliveredStories.reduce((sum, s) => sum + s.points, 0);
    const topic = [
      `Sprint ${sprintId} review:`,
      `${deliveredStories.length} stories delivered (${totalPoints} points).`,
      `Coverage: ${qualityMetrics.coveragePercent}%,`,
      `gates passed: ${qualityMetrics.gatesPassed},`,
      `blocages: ${qualityMetrics.blocagesCount}.`,
    ].join(' ');

    const participants = this.participantPort.getParticipants();
    const result = await this.roundTable.run(topic, participants);

    const recommendations = result.contributions
      .filter((c) => c.round === result.rounds)
      .map((c) => c.position);

    return {
      summary: result.synthesis,
      recommendations,
      nextSprintFocus: result.consensus ? 'Continue current trajectory' : 'Address team alignment',
    };
  }
}
