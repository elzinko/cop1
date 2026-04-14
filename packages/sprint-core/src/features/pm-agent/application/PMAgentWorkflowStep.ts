import { extractMarkdownSection } from '../../dev-agent/domain/DevPromptTemplate.js';
import type { StepResult } from '../../workflow/domain/StepResult.js';
import type { WorkflowContext } from '../../workflow/domain/WorkflowContext.js';
import type { WorkflowStep } from '../../workflow/domain/WorkflowStep.js';

/**
 * @deprecated Since 2026-04-14 (EA11-S1). Thin `WorkflowStep` wrapper around the
 * legacy `PMAgent`. Superseded by BMAD-driven multi-turn sessions invoked through
 * `BMADSessionPort` (ADR-012). This wrapper remains as a safety-net fallback while
 * `config.workflow.useBMAD=false` is still supported (deprecated in EA11-S2).
 * Migration path: BMAD `create-story` / PM orchestration driven by
 * `SupervisorService` / `OrchestratorService` (EA10). Scheduled for removal once
 * EA10-S9 integration test passes in production.
 */
export class PMAgentWorkflowStep implements WorkflowStep {
  name = 'pm';

  async run(context: WorkflowContext): Promise<StepResult> {
    try {
      if (!context.storyContent) {
        return { status: 'ok', report: 'WARNING: No story content available for PM validation.' };
      }

      const acSection = extractMarkdownSection(context.storyContent, 'Acceptance Criteria');
      if (!acSection) {
        return {
          status: 'ok',
          report: 'WARNING: No acceptance criteria found in story content.',
        };
      }

      const criteria = this.parseAcceptanceCriteria(acSection);
      if (criteria.length === 0) {
        return {
          status: 'ok',
          report: 'WARNING: Could not parse any acceptance criteria from story.',
        };
      }

      const report = this.buildValidationReport(context.storyId, criteria);
      return { status: 'ok', report };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: 'ok',
        report: `WARNING: PM validation encountered an error: ${message}`,
      };
    }
  }

  private parseAcceptanceCriteria(acSection: string): string[] {
    return acSection
      .split('\n')
      .map((line) => line.replace(/^(\d+\.\s*|-\s*|\*\s*)/, '').trim())
      .filter((line) => line.length > 0);
  }

  private buildValidationReport(storyId: string, criteria: string[]): string {
    const lines = [
      `# PM Validation Report — ${storyId}`,
      '',
      `**Acceptance Criteria found:** ${criteria.length}`,
      '',
      '| # | Criterion | Status |',
      '|---|-----------|--------|',
    ];

    for (let i = 0; i < criteria.length; i++) {
      const criterion = criteria[i] ?? '';
      const escaped = criterion.replace(/\|/g, '\\|');
      const truncated = escaped.length > 80 ? `${escaped.slice(0, 77)}...` : escaped;
      lines.push(`| ${i + 1} | ${truncated} | Noted |`);
    }

    lines.push('', '_Note: MVP heuristic validation — AC status is informational only._');

    return lines.join('\n');
  }
}
