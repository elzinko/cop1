import type { QuestionHandler } from '../domain/ports/BMADSessionPort.js';
import type {
  SupervisorContext,
  SupervisorLLMPort,
  SupervisorQuestion,
  SupervisorResponse,
} from '../domain/ports/SupervisorLLMPort.js';
import type { SessionHistoryReader } from './SessionHistoryReader.js';
import { type SessionInteraction, type SessionLogger, deriveEpicId } from './SessionLogger.js';

export interface DeterministicPattern {
  pattern: RegExp;
  answer: string | ((ctx: SupervisorContext) => string);
}

// Anchored patterns: require word boundaries or bracket markers to avoid
// false positives like "discontinue", "proceedings", "approved list", etc.
const DEFAULT_PATTERNS: readonly DeterministicPattern[] = Object.freeze([
  {
    pattern: /(^|\s)(continue|proceed|ready to (?:proceed|start))\b|\[c\]/i,
    answer: 'C',
  },
  { pattern: /\byolo\b|\[y\]|\bauto.?mode\b/i, answer: 'y' },
  {
    pattern: /\bwhich story\b|\bstory.*select\b|\bselect.*story\b/i,
    answer: (ctx) => ctx.storyId,
  },
  { pattern: /\b(confirm|approve|looks good)\b|\[a\]/i, answer: 'c' },
  { pattern: /\badvanced elicitation\b|\bparty.?mode\b/i, answer: 'c' },
]);

/**
 * Orchestrates intelligent responses to BMAD workflow questions at three levels:
 * 1. Deterministic — pattern matching for simple prompts
 * 2. LLM Supervisor — delegates complex questions to SupervisorLLMPort
 * 3. Escalation — returns escalated response if LLM says ESCALATE or fails
 *
 * **Concurrency:** A SupervisorService instance is scoped to a SINGLE session /
 * story at a time. Do not share an instance across concurrent `respond()` calls
 * for different sessions — the turn counter, session id and enriched-context
 * cache are instance state. Call {@link setWorkflowContext} before each new
 * session; that resets all per-session state.
 */
export class SupervisorService {
  private readonly patterns: readonly DeterministicPattern[];
  private currentWorkflowCommand = '';
  private currentStoryId = '';
  private currentSessionId = '';
  private currentContext: SupervisorContext | null = null;
  private turnCounter = 0;
  private historyFetchedForStory: string | null = null;

  constructor(
    private readonly llmPort: SupervisorLLMPort,
    private readonly sessionLogger: SessionLogger,
    private readonly historyReader?: SessionHistoryReader,
    patterns?: DeterministicPattern[],
  ) {
    this.patterns = patterns ?? DEFAULT_PATTERNS;
  }

  setWorkflowContext(
    workflowCommand: string,
    storyId: string,
    context: SupervisorContext,
    sessionId?: string,
  ): void {
    this.currentWorkflowCommand = workflowCommand;
    this.currentStoryId = storyId;
    this.currentSessionId = sessionId ?? '';
    this.currentContext = context;
    this.turnCounter = 0;
    this.historyFetchedForStory = null;
  }

  async respond(
    question: SupervisorQuestion,
    context: SupervisorContext,
  ): Promise<SupervisorResponse> {
    this.turnCounter++;
    const startTime = Date.now();

    // Level 1: Deterministic
    const deterministicAnswer = this.matchDeterministic(question.currentQuestion, context);
    if (deterministicAnswer !== null && deterministicAnswer !== '') {
      const response: SupervisorResponse = {
        answer: deterministicAnswer,
        escalated: false,
        durationMs: Date.now() - startTime,
      };
      this.logInteraction(question, response, 'deterministic');
      return response;
    }

    // If a deterministic pattern matched but resolved to an empty string
    // (e.g. story-selection with no storyId in context), escalate rather
    // than returning a bogus empty answer.
    if (deterministicAnswer === '') {
      const response: SupervisorResponse = {
        answer: '',
        escalated: true,
        escalationReason:
          'Deterministic pattern matched but produced empty answer (missing context)',
        durationMs: Date.now() - startTime,
      };
      this.logInteraction(question, response, 'escalation');
      return response;
    }

    // Enrich context with session history if available (without mutating caller's context).
    // Cached per story so we only hit disk once per setWorkflowContext() cycle.
    if (
      this.historyReader &&
      context.sessionHistory.length === 0 &&
      this.historyFetchedForStory !== question.storyId
    ) {
      this.historyFetchedForStory = question.storyId;
      try {
        const history = await this.historyReader.getHistoryForStory(question.storyId);
        if (history.length > 0) {
          context = {
            ...context,
            sessionHistory: history.map((entry) => ({
              role: entry.role === 'workflow' ? ('workflow' as const) : ('supervisor' as const),
              content: entry.content,
            })),
          };
        }
      } catch {
        // Non-critical — continue without history
      }
    }

    // Level 2: LLM Supervisor
    try {
      const llmResponse = await this.llmPort.generateResponse(question, context);

      // Level 3: Escalation detection from LLM response
      if (llmResponse.answer.startsWith('ESCALATE:')) {
        const escalationReason = llmResponse.answer.slice('ESCALATE:'.length).trim();
        const response: SupervisorResponse = {
          answer: llmResponse.answer,
          escalated: true,
          escalationReason,
          durationMs: llmResponse.durationMs,
          tokensUsed: llmResponse.tokensUsed,
        };
        this.logInteraction(question, response, 'escalation');
        return response;
      }

      this.logInteraction(question, llmResponse, 'llm');
      return llmResponse;
    } catch (error) {
      // Level 3: Escalation on LLM failure
      const reason = error instanceof Error ? error.message : String(error);
      const response: SupervisorResponse = {
        answer: '',
        escalated: true,
        escalationReason: `LLM error: ${reason}`,
        durationMs: Date.now() - startTime,
      };
      this.logInteraction(question, response, 'escalation');
      return response;
    }
  }

  createQuestionHandler(): QuestionHandler {
    return async (toolName: string, input: unknown) => {
      if (toolName !== 'AskUserQuestion') {
        return { behavior: 'allow', updatedInput: input as Record<string, unknown> };
      }

      const payload = input as { questions?: Array<{ question: string }> };
      const questionText = payload.questions?.[0]?.question;

      if (!questionText) {
        return {
          behavior: 'deny',
          message: 'ESCALATE: No question text in AskUserQuestion payload',
        };
      }

      const question: SupervisorQuestion = {
        currentQuestion: questionText,
        workflowCommand: this.currentWorkflowCommand,
        storyId: this.currentStoryId,
      };

      const context = this.currentContext ?? {
        workflowCommand: this.currentWorkflowCommand,
        storyId: this.currentStoryId,
        storyContent: '',
        projectContext: '',
        architectureRules: '',
        iamtheLawRules: '',
        sessionHistory: [],
        currentQuestion: questionText,
      };

      const response = await this.respond(question, context);

      if (response.escalated) {
        return { behavior: 'deny', message: `ESCALATE: ${response.escalationReason}` };
      }

      const answers: Record<string, string> = {};
      if (payload.questions) {
        for (const q of payload.questions) {
          answers[q.question] = response.answer;
        }
      }

      return {
        behavior: 'allow',
        updatedInput: { ...payload, answers },
      };
    };
  }

  private matchDeterministic(questionText: string, context: SupervisorContext): string | null {
    for (const { pattern, answer } of this.patterns) {
      if (pattern.test(questionText)) {
        return typeof answer === 'function' ? answer(context) : answer;
      }
    }
    return null;
  }

  private logInteraction(
    question: SupervisorQuestion,
    response: SupervisorResponse,
    method: SessionInteraction['analysis']['method'],
  ): void {
    // Single timestamp for question + answer rows so sort stability is preserved
    // under clock skew / same-ms collisions.
    const timestamp = new Date().toISOString();
    const storyId = question.storyId;
    const epicId = deriveEpicId(storyId);

    // Log the question
    this.sessionLogger.logInteraction({
      timestamp,
      sessionId: this.currentSessionId,
      storyId,
      epicId,
      workflowCommand: question.workflowCommand,
      turn: this.turnCounter,
      role: 'workflow',
      content: question.currentQuestion,
      analysis: { type: 'question_simple', method },
      durationMs: 0,
    });

    // Log the answer
    const analysisType: SessionInteraction['analysis']['type'] = response.escalated
      ? 'escalation'
      : method === 'deterministic'
        ? 'question_simple'
        : 'question_complex';

    this.sessionLogger.logInteraction({
      timestamp,
      sessionId: this.currentSessionId,
      storyId,
      epicId,
      workflowCommand: question.workflowCommand,
      turn: this.turnCounter,
      role: 'supervisor',
      content: response.answer,
      analysis: { type: analysisType, method },
      durationMs: response.durationMs,
      tokensUsed: response.tokensUsed,
    });
  }
}
