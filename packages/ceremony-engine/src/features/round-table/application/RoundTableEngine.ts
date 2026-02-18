import type {
  Contribution,
  RoundTableParticipant,
  RoundTableResult,
} from '../domain/RoundTableTypes.js';

export class RoundTableEngine {
  constructor(
    private readonly consensusThreshold: number = 0.7,
    private readonly maxRounds: number = 2,
  ) {}

  async run(topic: string, participants: RoundTableParticipant[]): Promise<RoundTableResult> {
    const allContributions: Contribution[] = [];
    let currentRound = 1;

    while (currentRound <= this.maxRounds) {
      for (const participant of participants) {
        const position = await participant.contribute(topic, allContributions);
        allContributions.push({
          agent: participant.name,
          position,
          round: currentRound,
        });
      }

      const score = this.computeConsensus(allContributions, currentRound);
      if (score >= this.consensusThreshold) {
        return {
          consensus: true,
          synthesis: this.synthesize(allContributions),
          contributions: allContributions,
          rounds: currentRound,
        };
      }

      currentRound++;
    }

    return {
      consensus: false,
      synthesis: this.synthesize(allContributions),
      contributions: allContributions,
      rounds: this.maxRounds,
    };
  }

  private computeConsensus(contributions: Contribution[], round: number): number {
    const roundContributions = contributions.filter((c) => c.round === round);
    if (roundContributions.length < 2) return 1;

    const positions = roundContributions.map((c) => c.position.toLowerCase().trim());
    let agreements = 0;
    let comparisons = 0;

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        comparisons++;
        const a = positions[i] ?? '';
        const b = positions[j] ?? '';
        if (this.isSimilar(a, b)) {
          agreements++;
        }
      }
    }

    return comparisons === 0 ? 1 : agreements / comparisons;
  }

  private isSimilar(a: string, b: string): boolean {
    // Simple heuristic: check if positions share significant keywords
    const wordsA = new Set(a.split(/\s+/).filter((w) => w.length > 3));
    const wordsB = new Set(b.split(/\s+/).filter((w) => w.length > 3));
    if (wordsA.size === 0 || wordsB.size === 0) return a === b;

    let shared = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) shared++;
    }
    return shared / Math.max(wordsA.size, wordsB.size) > 0.3;
  }

  private synthesize(contributions: Contribution[]): string {
    const lastRound = Math.max(...contributions.map((c) => c.round));
    const latest = contributions.filter((c) => c.round === lastRound);
    return latest.map((c) => `${c.agent}: ${c.position}`).join('\n');
  }
}
