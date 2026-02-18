export interface Contribution {
  agent: string;
  position: string;
  round: number;
}

export interface RoundTableResult {
  consensus: boolean;
  synthesis: string;
  contributions: Contribution[];
  rounds: number;
}

export interface RoundTableParticipant {
  name: string;
  contribute(topic: string, previousContributions: Contribution[]): Promise<string>;
}
