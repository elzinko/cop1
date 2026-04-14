import type { BacklogPort, BacklogStory } from '../domain/ports/BacklogPort.js';

const FIBONACCI = [1, 2, 3, 5, 8, 13];

/**
 * @deprecated Since 2026-04-14 (EA11-S1). The standalone cop1 agent pattern is
 * superseded by BMAD-driven multi-turn sessions invoked through `BMADSessionPort`
 * (ADR-012). This class remains as a safety-net fallback while
 * `config.workflow.useBMAD=false` is still supported (deprecated in EA11-S2).
 * Migration path: BMAD `create-story` / PM orchestration driven by
 * `SupervisorService` / `OrchestratorService` (EA10). Scheduled for removal once
 * EA10-S9 integration test passes in production.
 */
export class PMAgent {
  constructor(
    private readonly backlog: BacklogPort,
    private readonly sprintsAhead: number = 2,
  ) {}

  backlogHealthReport(): string {
    const stories = this.backlog.getStories();
    const ready = stories.filter((s) => s.status === 'ready');
    const grooming = stories.filter((s) => s.status === 'backlog');
    const inProgress = stories.filter((s) => s.status === 'in-progress');
    const done = stories.filter((s) => s.status === 'done');

    const lines: string[] = [
      '# Backlog Health Report',
      '',
      '## Summary',
      `- Total stories: ${stories.length}`,
      `- Ready for sprint: ${ready.length}`,
      `- In grooming: ${grooming.length}`,
      `- In progress: ${inProgress.length}`,
      `- Done: ${done.length}`,
      '',
    ];

    const avgVelocity = this.estimateVelocity(done);
    const neededForSprints = avgVelocity * this.sprintsAhead;

    if (ready.length < neededForSprints) {
      lines.push(
        '## Warning',
        `Only ${ready.length} stories ready, need ~${neededForSprints} for next ${this.sprintsAhead} sprints.`,
        '',
      );
    }

    if (grooming.length > 0) {
      lines.push('## Stories Needing Grooming');
      for (const s of grooming) {
        lines.push(`- ${s.id}: ${s.title} (${s.points ?? 'unestimated'} pts)`);
      }
    }

    return lines.join('\n');
  }

  estimateEffort(story: BacklogStory): { estimate: number; justification: string } {
    const acCount = story.acceptanceCriteria.length;
    const titleComplexity = story.title.split(' ').length;

    const raw = Math.max(1, Math.round(acCount * 1.5 + titleComplexity * 0.3));
    const estimate = this.nearestFibonacci(raw);

    return {
      estimate,
      justification: `Based on ${acCount} acceptance criteria and title complexity. Nearest Fibonacci: ${estimate}.`,
    };
  }

  private nearestFibonacci(value: number): number {
    let closest = FIBONACCI[0] ?? 1;
    for (const fib of FIBONACCI) {
      if (Math.abs(fib - value) < Math.abs(closest - value)) {
        closest = fib;
      }
    }
    return closest;
  }

  private estimateVelocity(doneStories: BacklogStory[]): number {
    if (doneStories.length === 0) return 5;
    const totalPoints = doneStories.reduce((sum, s) => sum + (s.points ?? 0), 0);
    return Math.max(1, Math.round((totalPoints / Math.max(1, doneStories.length)) * 3));
  }
}
