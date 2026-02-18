import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { EventBus } from '@cop1/shared-kernel';
import {
  type ArchitectureRuleProposal,
  type ImprovementProposal,
  type RefactoringStoryProposal,
  RetroOutputMissingError,
} from '../domain/RetroTypes.js';

export interface RetroInput {
  sprintMetrics: {
    storiesCompleted: number;
    storiesPlanned: number;
    blocages: number;
    gateFailures: number;
  };
}

export interface RetroAnalyzer {
  analyze(input: RetroInput): Promise<{
    architectureRules: ArchitectureRuleProposal[];
    refactoringStories: RefactoringStoryProposal[];
  }>;
}

export class RetroCeremony {
  constructor(
    private readonly projectPath: string,
    private readonly eventBus: EventBus,
    private readonly analyzer: RetroAnalyzer,
  ) {}

  async run(input: RetroInput): Promise<ImprovementProposal[]> {
    const { architectureRules, refactoringStories } = await this.analyzer.analyze(input);

    if (architectureRules.length === 0) {
      throw new RetroOutputMissingError('ArchitectureRuleProposal');
    }
    if (refactoringStories.length === 0) {
      throw new RetroOutputMissingError('RefactoringStoryProposal');
    }

    const proposals: ImprovementProposal[] = [...architectureRules, ...refactoringStories];

    this.persistProposals(proposals);

    for (const proposal of proposals) {
      this.eventBus.emit('improvement.suggestion.submitted', proposal);
    }

    return proposals;
  }

  private persistProposals(proposals: ImprovementProposal[]): void {
    const dir = join(this.projectPath, '.cop1');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const filePath = join(dir, 'improvement-decisions.jsonl');
    for (const proposal of proposals) {
      appendFileSync(filePath, `${JSON.stringify(proposal)}\n`, 'utf-8');
    }
  }
}
