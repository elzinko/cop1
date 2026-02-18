import type { RoundTableEngine } from '../../round-table/application/RoundTableEngine.js';
import type {
  GroomingInput,
  GroomingParticipantPort,
  GroomingResult,
  RefinedStory,
} from '../domain/GroomingTypes.js';

export class GroomingCeremony {
  constructor(
    private readonly roundTable: RoundTableEngine,
    private readonly participantPort: GroomingParticipantPort,
  ) {}

  async run(input: GroomingInput): Promise<GroomingResult> {
    const refinedStories: RefinedStory[] = [];

    for (const story of input.stories) {
      const topic = `Refine story "${story.title}" (${story.acceptanceCriteria.length} AC): ${story.acceptanceCriteria.join(', ')}`;
      const participants = this.participantPort.getParticipants();
      const result = await this.roundTable.run(topic, participants);

      const hasEnoughAC = story.acceptanceCriteria.length >= 2;
      const ready = hasEnoughAC && result.consensus;

      refinedStories.push({
        id: story.id,
        estimatedPoints: story.acceptanceCriteria.length * 2,
        ready,
      });
    }

    return { refinedStories };
  }
}
