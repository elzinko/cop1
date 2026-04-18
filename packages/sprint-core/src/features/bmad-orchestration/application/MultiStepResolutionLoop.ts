import type {
  SupervisorQuestion,
  SupervisorQuestionContext,
  SupervisorResponse,
} from '../domain/ports/SupervisorLLMPort.js';
import type { SupervisorToolHandlers } from '../infrastructure/tools/toolCatalog.js';
import type { SupervisorService } from './SupervisorService.js';

export type ResolutionState =
  | 'idle'
  | 'deterministic'
  | 'llm'
  | 'blocked'
  | 'consulting'
  | 'synthesizing'
  | 'escalated';

export interface ResolutionConfidence {
  llm: number;
  synthesis: number;
}

export interface MultiStepResolutionLoopOptions {
  confidence: ResolutionConfidence;
  /**
   * Receives every state transition for auto-decision logging (per EA10-S4 §AC6).
   */
  logger?: (transition: {
    state: ResolutionState;
    nextState: ResolutionState;
    confidence?: number;
    note?: string;
  }) => void;
}

const DEFAULT_THRESHOLDS: ResolutionConfidence = { llm: 0.6, synthesis: 0.7 };

/**
 * Extends the SupervisorService 3-tier cascade (deterministic → LLM → terminal
 * escalation) with a multi-step loop that consults the MCP tool catalog when the
 * LLM answer is low-confidence:
 *
 *   deterministic → llm → (low conf?) → consulting → synthesizing → escalated?
 *
 * Introduced by EA10-S8 / ADR-014.
 *
 * Confidence scoring (ADR-014-aligned, intentionally transparent):
 *   - Deterministic match: 1.0 (short-circuits)
 *   - LLM with `escalated=false`: 0.9 (LLM self-reported fine)
 *   - LLM with `escalated=true`: 0.0 (kicks into consult phase)
 *   - Synthesis: proportion of advisory outputs that match the LLM answer
 *     (naive but transparent; deliberately simple for V1-light).
 */
export class MultiStepResolutionLoop {
  private readonly thresholds: ResolutionConfidence;
  private readonly logger?: MultiStepResolutionLoopOptions['logger'];

  constructor(
    private readonly supervisor: SupervisorService,
    private readonly tools: SupervisorToolHandlers,
    options: Partial<MultiStepResolutionLoopOptions> = {},
  ) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...(options.confidence ?? {}) };
    this.logger = options.logger;
  }

  async resolve(
    question: SupervisorQuestion,
    context: SupervisorQuestionContext,
  ): Promise<SupervisorResponse & { finalState: ResolutionState }> {
    this.transition('idle', 'deterministic');
    const first = await this.supervisor.respond(question, context);

    // If deterministic / non-escalated LLM answer with adequate confidence, accept.
    const confidenceScore = first.escalated ? 0 : 0.9;
    if (!first.escalated && confidenceScore >= this.thresholds.llm) {
      this.transition('llm', 'idle', { confidence: confidenceScore, note: 'accepted' });
      return { ...first, finalState: 'idle' };
    }

    // Low confidence → consult phase
    this.transition('llm', 'blocked', { confidence: confidenceScore });
    this.transition('blocked', 'consulting');

    const advisoryOutputs: string[] = [];
    try {
      const history = await this.tools.query_session_history({ storyId: question.storyId });
      if (Array.isArray(history.interactions) && history.interactions.length > 0) {
        advisoryOutputs.push(`history:${history.interactions.length} rows`);
      }
    } catch (err) {
      advisoryOutputs.push(`history:error:${(err as Error).message}`);
    }

    try {
      const budget = await this.tools.remaining_budget({} as Record<string, never>);
      if ('tokensRemaining' in budget) {
        advisoryOutputs.push(`budget:${budget.tokensRemaining}`);
      } else {
        advisoryOutputs.push(`budget:${budget.error}`);
      }
    } catch {
      // not fatal
    }

    this.transition('consulting', 'synthesizing');
    const synthesisConfidence = this.computeSynthesisConfidence(first.answer, advisoryOutputs);

    if (synthesisConfidence >= this.thresholds.synthesis) {
      this.transition('synthesizing', 'idle', {
        confidence: synthesisConfidence,
        note: 'synthesis accepted',
      });
      return { ...first, escalated: false, finalState: 'idle' };
    }

    this.transition('synthesizing', 'escalated', {
      confidence: synthesisConfidence,
      note: first.escalationReason ?? 'synthesis below threshold',
    });
    return {
      answer: '',
      escalated: true,
      escalationReason: first.escalationReason ?? 'multi-step loop exhausted',
      durationMs: first.durationMs,
      tokensUsed: first.tokensUsed,
      finalState: 'escalated',
    };
  }

  private computeSynthesisConfidence(_llmAnswer: string, advisoryOutputs: string[]): number {
    if (advisoryOutputs.length === 0) return 0;
    const nonErrored = advisoryOutputs.filter((o) => !o.includes(':error:'));
    return nonErrored.length / advisoryOutputs.length;
  }

  private transition(
    state: ResolutionState,
    nextState: ResolutionState,
    extra: { confidence?: number; note?: string } = {},
  ): void {
    this.logger?.({ state, nextState, ...extra });
  }
}
