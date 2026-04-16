import type {
  BMADSessionContext,
  BMADSessionPort,
  SessionHandle,
  SessionTurnResult,
  SupervisorAnswerContext,
  SupervisorService,
} from '@cop1/sprint-core';
import type { BMADCommandRunner } from '../application/OrchestratorService.js';

const MAX_FOLLOWUP_TURNS = 3;

export interface DefaultBMADCommandRunnerDeps {
  sessionPort: BMADSessionPort;
  supervisorService: SupervisorService;
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
  return async ({ command, storyKey, projectRoot }) => {
    const supervisorContext: SupervisorAnswerContext = {
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
      return {
        success: false,
        escalated: true,
        note: error instanceof Error ? error.message : String(error),
      };
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
      return {
        success: false,
        escalated: true,
        note: lastTurn.errorMessage ?? lastTurn.output ?? 'session error',
      };
    }
    if (lastTurn.output.length > 0) outputs.push(lastTurn.output);

    let followups = 0;
    while (!lastTurn.completed && followups < MAX_FOLLOWUP_TURNS) {
      followups++;
      try {
        lastTurn = await deps.sessionPort.continueSession(handle.sessionId, 'C');
      } catch (error) {
        return {
          success: false,
          escalated: true,
          note: error instanceof Error ? error.message : String(error),
        };
      }
      if (lastTurn.output.length > 0) outputs.push(lastTurn.output);
      if (lastTurn.error === true) {
        return {
          success: false,
          escalated: true,
          note: lastTurn.errorMessage ?? lastTurn.output ?? 'session error',
        };
      }
    }

    if (!lastTurn.completed) {
      return {
        success: false,
        escalated: true,
        note: 'session did not complete within follow-up budget',
      };
    }

    const nextStatus = inferNextStatus(command);
    const joined = outputs.join('\n');
    return {
      success: true,
      nextStatus,
      note: joined.length > 0 ? joined.slice(0, 500) : undefined,
    };
  };
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
