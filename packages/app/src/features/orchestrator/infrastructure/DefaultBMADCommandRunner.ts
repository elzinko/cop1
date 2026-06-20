import type {
  BMADSessionContext,
  BMADSessionPort,
  ExchangeFrontMatter,
  SessionHandle,
  SessionInteractionCollector,
  SessionTurnResult,
  SupervisorQuestionContext,
  SupervisorService,
} from '@cop1/sprint-core';
import type { ExchangeHistoryWriter } from '@cop1/sprint-core';
import type { BMADCommandRunner } from '../application/OrchestratorService.js';
import { type VerificationGate, shouldVerify } from '../domain/VerificationGate.js';

const MAX_FOLLOWUP_TURNS = 3;

export interface DefaultBMADCommandRunnerDeps {
  sessionPort: BMADSessionPort;
  supervisorService: SupervisorService;
  /** EA14-S2: optional Track 2 exchange history writer. */
  exchangeHistoryWriter?: ExchangeHistoryWriter;
  /** EA14-S2: collector that captures interactions for Track 2. */
  interactionCollector?: SessionInteractionCollector;
  /** Sprint 2 (ADR-016): optional verification gate run after code-producing commands. */
  verificationGate?: VerificationGate;
}

/**
 * Default `BMADCommandRunner` — drives a real BMAD session per
 * `(story, command)` tuple via `BMADSessionPort` and routes intercepted
 * questions through `SupervisorService`. Single-attempt, no retry, no budget
 * gate (the orchestrator is the retry boundary; budget enforcement is tracked
 * separately in the V1.1 hardening backlog).
 *
 * Mirrors the session lifecycle encoded in `BMADSessionStep`, but at the
 * command level — so callers that want a `BMADCommandRunner` shape (instead
 * of a `WorkflowStep`) can use it directly. The duplication is intentional
 * and documented until the sprint-core extraction story lands.
 */
export function createDefaultBMADCommandRunner(
  deps: DefaultBMADCommandRunnerDeps,
): BMADCommandRunner {
  return async ({ command, storyKey, epicId, projectRoot }) => {
    const startedAt = new Date().toISOString();

    // Drain any stale interactions from a previous command.
    deps.interactionCollector?.drain();

    const supervisorContext: SupervisorQuestionContext = {
      workflowCommand: command,
      storyId: storyKey,
      storyContent: '',
      projectContext: '',
      architectureRules: '',
      iamtheLawRules: '',
      sessionHistory: [],
      currentQuestion: '',
    };

    // Pre-wire supervisor context for any first-turn intercepted question.
    deps.supervisorService.setWorkflowContext(command, storyKey, supervisorContext);

    const bmadContext: BMADSessionContext = {
      projectPath: projectRoot,
      storyId: storyKey,
    };

    let handle: SessionHandle;
    try {
      handle = await deps.sessionPort.startSession(command, bmadContext);
    } catch (error) {
      const result = {
        success: false,
        escalated: true,
        note: error instanceof Error ? error.message : String(error),
      };
      await writeExchangeRecord(deps, {
        sessionId: '',
        storyId: storyKey,
        sprintId: epicId,
        command,
        startedAt,
        status: 'failed',
      });
      return result;
    }

    // Re-wire supervisor context with real sessionId for log correlation.
    deps.supervisorService.setWorkflowContext(
      command,
      storyKey,
      supervisorContext,
      handle.sessionId,
    );

    const outputs: string[] = [];
    let lastTurn: SessionTurnResult = handle.firstTurn;

    if (lastTurn.error === true) {
      const result = {
        success: false,
        escalated: true,
        note: lastTurn.errorMessage ?? lastTurn.output ?? 'session error',
      };
      await writeExchangeRecord(deps, {
        sessionId: handle.sessionId,
        storyId: storyKey,
        sprintId: epicId,
        command,
        startedAt,
        status: 'failed',
      });
      return result;
    }
    if (lastTurn.output.length > 0) outputs.push(lastTurn.output);

    let followups = 0;
    while (!lastTurn.completed && followups < MAX_FOLLOWUP_TURNS) {
      followups++;
      try {
        lastTurn = await deps.sessionPort.continueSession(handle.sessionId, 'C');
      } catch (error) {
        const result = {
          success: false,
          escalated: true,
          note: error instanceof Error ? error.message : String(error),
        };
        await writeExchangeRecord(deps, {
          sessionId: handle.sessionId,
          storyId: storyKey,
          sprintId: epicId,
          command,
          startedAt,
          status: 'failed',
        });
        return result;
      }
      if (lastTurn.output.length > 0) outputs.push(lastTurn.output);
      if (lastTurn.error === true) {
        const result = {
          success: false,
          escalated: true,
          note: lastTurn.errorMessage ?? lastTurn.output ?? 'session error',
        };
        await writeExchangeRecord(deps, {
          sessionId: handle.sessionId,
          storyId: storyKey,
          sprintId: epicId,
          command,
          startedAt,
          status: 'failed',
        });
        return result;
      }
    }

    if (!lastTurn.completed) {
      const result = {
        success: false,
        escalated: true,
        note: 'session did not complete within follow-up budget',
      };
      await writeExchangeRecord(deps, {
        sessionId: handle.sessionId,
        storyId: storyKey,
        sprintId: epicId,
        command,
        startedAt,
        status: 'escalated',
      });
      return result;
    }

    if (deps.verificationGate && shouldVerify(command)) {
      const verification = await deps.verificationGate.verify({ projectRoot, command, storyKey });
      if (!verification.passed) {
        await writeExchangeRecord(deps, {
          sessionId: handle.sessionId,
          storyId: storyKey,
          sprintId: epicId,
          command,
          startedAt,
          status: 'failed',
        });
        return { success: false, escalated: true, note: verification.summary };
      }
    }

    const nextStatus = inferNextStatus(command);
    const joined = outputs.join('\n');

    await writeExchangeRecord(deps, {
      sessionId: handle.sessionId,
      storyId: storyKey,
      sprintId: epicId,
      command,
      startedAt,
      status: 'success',
    });

    return {
      success: true,
      nextStatus,
      note: joined.length > 0 ? joined.slice(0, 500) : undefined,
    };
  };
}

/**
 * EA14-S2: Write Track 2 exchange record if writer + collector are wired.
 * Fire-and-forget semantics — failures are logged but do not fail the command.
 */
async function writeExchangeRecord(
  deps: DefaultBMADCommandRunnerDeps,
  meta: {
    sessionId: string;
    storyId: string;
    sprintId: string;
    command: string;
    startedAt: string;
    status: ExchangeFrontMatter['status'];
  },
): Promise<void> {
  if (!deps.exchangeHistoryWriter || !deps.interactionCollector) return;
  try {
    const interactions = deps.interactionCollector.drain();
    const frontMatter: ExchangeFrontMatter = {
      sessionId: meta.sessionId,
      storyId: meta.storyId,
      sprintId: meta.sprintId,
      command: meta.command,
      startedAt: meta.startedAt,
      endedAt: new Date().toISOString(),
      supervisorTurns: interactions.filter((i) => i.role === 'supervisor').length,
      status: meta.status,
    };
    await deps.exchangeHistoryWriter.write({ frontMatter, interactions });
  } catch (err) {
    // Best-effort — do not let Track 2 write failure break the session.
    console.warn(
      '[EA14-S2] Failed to write exchange history:',
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Command → next-status mapping. Mirrors the historical stub-runner behaviour
 * so downstream orchestrator state transitions remain stable during the
 * cut-over from stub to real runner.
 */
export function inferNextStatus(command: string): string {
  if (command.includes('create-story')) return 'ready-for-dev';
  if (command.includes('dev-story')) return 'in-review';
  return 'done';
}
