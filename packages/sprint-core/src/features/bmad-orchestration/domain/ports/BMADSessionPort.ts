/**
 * Port for multi-turn BMAD session interaction (ADR-012).
 * Complements the single-shot BMADCommandPort with stateful, interactive sessions.
 */

/** Context provided when starting a BMAD session. */
export interface BMADSessionContext {
  /** Absolute path to the project root. */
  projectPath: string;
  /** Story ID being processed (e.g., "EA9-S1"). */
  storyId?: string;
  /** Additional context key-value pairs passed to the session prompt. */
  metadata?: Record<string, string>;
}

/** Handle returned after starting a session, containing the session ID and first turn result. */
export interface SessionHandle {
  /** Unique session identifier (UUID). */
  sessionId: string;
  /** Result of the first turn in the session. */
  firstTurn: SessionTurnResult;
}

/** Result of a single turn in a BMAD session. */
export interface SessionTurnResult {
  /** Whether the workflow has completed (no more turns needed). */
  completed: boolean;
  /** Text output from the assistant for this turn. */
  output: string;
  /** Whether an error occurred during this turn. */
  error?: boolean;
  /** Error message if error is true. */
  errorMessage?: string;
  /** Number of tokens used in this turn, if available. */
  tokensUsed?: number;
  /** Duration of this turn in milliseconds. */
  durationMs: number;
}

/**
 * Callback type for handling intercepted tool calls (e.g., AskUserQuestion).
 * Injected into the adapter; the SupervisorService (EA9-S3) provides the real implementation.
 */
export type QuestionHandler = (
  toolName: string,
  input: unknown,
) => Promise<
  | { behavior: 'allow'; updatedInput: Record<string, unknown> }
  | { behavior: 'deny'; message: string }
>;

/** Port interface for multi-turn BMAD session interaction. */
export interface BMADSessionPort {
  /** Start a new interactive BMAD session with the given command and context. */
  startSession(command: string, context: BMADSessionContext): Promise<SessionHandle>;

  /** Continue an existing session by sending a follow-up message. */
  continueSession(sessionId: string, message: string): Promise<SessionTurnResult>;
}
