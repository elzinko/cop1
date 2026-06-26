import type { EventBus } from '@cop1/shared-kernel';
import type {
  BMADSessionContext,
  BMADSessionPort,
  DoDCheck,
  DoDCheckRegistry,
  DoDFailure,
  ExchangeFrontMatter,
  HistoryEntry,
  Rule,
  RuleSet,
  SessionHandle,
  SessionInteractionCollector,
  SessionTurnResult,
  SupervisorQuestionContext,
  SupervisorService,
} from '@cop1/sprint-core';
import {
  DoDService,
  type ExchangeHistoryWriter,
  IamTheLawLoader,
  assembleRuleEnforcement,
  flattenRules,
  formatAdvisory,
} from '@cop1/sprint-core';
import type { BMADCommandRunner } from '../application/OrchestratorService.js';
import { type CommitAnchorPort, commitAnchorMessage } from '../domain/CommitAnchor.js';
import type { VerificationGate } from '../domain/VerificationGate.js';
import {
  type WorkspaceInspectionPort,
  hasImplementationChanges,
  shouldHaveCodeChanges,
} from '../domain/WorkspaceChanges.js';
import { ReviewVerdictDoDCheck } from './ReviewVerdictDoDCheck.js';
import { VerificationDoDCheck } from './VerificationDoDCheck.js';

const MAX_FOLLOWUP_TURNS = 3;

/**
 * Built-in Definition-of-Done criteria the orchestrator enforces at the story
 * transition seam (ADR-020). Order matters: the first failure becomes the
 * blocking note, preserving the historical gate ordering (verification before
 * review-verdict). Built-in defaults are the accepted policy when no project
 * `iamthelaw/global.yaml` overrides them.
 */
const DEFAULT_DOD_CRITERIA = ['verification', 'review_verdict'] as const;

/** Corrective "implement now" continuations when a dev command wrote no code. */
const DEFAULT_MAX_IMPLEMENTATION_RETRIES = 2;

/** Forcing prompt sent when a code-producing command only planned (no edits). */
const IMPLEMENT_NOW_PROMPT =
  'You have not modified any source files — only a plan was produced. Implement ' +
  "the story's acceptance criteria NOW by actually editing the project files with " +
  'the Write/Edit tools. Do not output another plan; make the concrete code changes.';

export interface DefaultBMADCommandRunnerDeps {
  sessionPort: BMADSessionPort;
  supervisorService: SupervisorService;
  /** EA14-S2: optional Track 2 exchange history writer. */
  exchangeHistoryWriter?: ExchangeHistoryWriter;
  /** EA14-S2: collector that captures interactions for Track 2. */
  interactionCollector?: SessionInteractionCollector;
  /** Sprint 2 (ADR-016): optional verification gate run after code-producing commands. */
  verificationGate?: VerificationGate;
  /**
   * Evidence gate (2026-06-22 post-mortem): inspects the working tree to prove a
   * code-producing command actually wrote source. Without it, a dev-story that
   * only prints a plan is accepted as done.
   */
  workspaceInspection?: WorkspaceInspectionPort;
  /** Max corrective "implement now" continuations (default 2). */
  maxImplementationRetries?: number;
  /**
   * Commit anchor (EA14-S3): when wired, the runner commits a verified
   * code-producing command's work as a durable rollback unit and records the
   * SHA in Track 2. Opt-in (auto-commit blast radius) — off unless injected.
   */
  commitAnchor?: CommitAnchorPort;
  /**
   * DoD completion gate (ADR-020): evaluates the built-in criteria
   * (`verification`, `review_verdict`) through a declarative registry instead
   * of the old inline if-blocks. Defaults to a real `DoDService` so production
   * wiring is unchanged; injectable for testing the routing seam.
   */
  dodService?: DoDService;
  /**
   * iamthelaw rule source (ADR-020 / fiche 0014). Resolves the project's
   * `RuleSet`; rules WITH a `check` become enforced DoD criteria, rules WITHOUT
   * one are formatted into the supervisor prompt (advisory). Defaults to a real
   * `IamTheLawLoader(projectRoot).load()`; injectable for tests.
   */
  lawProvider?: (projectRoot: string) => RuleSet;
  /**
   * iamthelaw audit sink (ADR-020 / fiche 0014). Receives a history entry when
   * a DoD failure is attributable to an enforced `check` rule. Defaults to the
   * loader's `appendHistory`. Best-effort — a throw never breaks the run.
   */
  auditSink?: (entry: HistoryEntry) => void;
  /**
   * Run event bus (ADR-020 / fiche 0016). When wired, the runner emits a
   * `dod.check.failed` event listing the unsatisfied DoD criteria so the web
   * mission-control can surface WHICH criteria blocked the story (not just the
   * generic log note). Optional — absent in tests / non-web wiring, in which
   * case nothing is emitted. The run's `TaggingEventBus` injects `runId`
   * downstream, so the runner intentionally does not set it here.
   */
  eventBus?: EventBus;
}

/**
 * Build the DoD check registry from the injected gates (ADR-020). The
 * verification adapter is present only when a `VerificationGate` is injected
 * (mirrors the old `if (deps.verificationGate && …)` guard); the review-verdict
 * adapter is always present (it needs no injected port). A criterion whose
 * adapter is absent is simply skipped by `DoDService.evaluate`.
 */
function buildDoDRegistry(verificationGate?: VerificationGate): DoDCheckRegistry {
  const checks: DoDCheck[] = [new ReviewVerdictDoDCheck()];
  if (verificationGate) checks.unshift(new VerificationDoDCheck(verificationGate));
  return new Map(checks.map((check) => [check.id, check]));
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
  // DoD completion gate (ADR-020): default-construct a real service + registry
  // so production wiring keeps working without injecting anything. Built once
  // per runner — the gates it depends on are fixed for the runner's lifetime.
  const dodService = deps.dodService ?? new DoDService();
  const dodRegistry = buildDoDRegistry(deps.verificationGate);

  // iamthelaw provider + audit sink (ADR-020 / fiche 0014). Default to a real
  // loader per projectRoot so production wiring needs no new required dep.
  const loadRules = deps.lawProvider ?? ((root: string) => new IamTheLawLoader(root).load());

  return async ({ command, storyKey, epicId, projectRoot }) => {
    const startedAt = new Date().toISOString();

    // Split the project's rules: enforced `check` ids extend the DoD criteria,
    // advisory rules feed the supervisor prompt (fixes the historical `''`).
    // Guard the load: a rule-load failure (FS race / EACCES) must never crash the
    // night-loop — fall back to no rules (advisory '' + built-in criteria only).
    let ruleSet: RuleSet;
    try {
      ruleSet = loadRules(projectRoot);
    } catch {
      ruleSet = emptyRuleSet();
    }
    const { enforcedChecks, advisory } = assembleRuleEnforcement(ruleSet);
    const auditSink =
      deps.auditSink ??
      ((entry: HistoryEntry) => new IamTheLawLoader(projectRoot).appendHistory(entry));

    // Drain any stale interactions from a previous command.
    deps.interactionCollector?.drain();

    const supervisorContext: SupervisorQuestionContext = {
      workflowCommand: command,
      storyId: storyKey,
      storyContent: '',
      projectContext: '',
      architectureRules: '',
      // Advisory iamthelaw rules (ADR-020 / fiche 0014) finally reach the
      // supervisor prompt — previously hard-coded to '' (the bug).
      iamtheLawRules: formatAdvisory(advisory),
      sessionHistory: [],
      currentQuestion: '',
    };

    // Pre-wire supervisor context for any first-turn intercepted question.
    deps.supervisorService.setWorkflowContext(command, storyKey, supervisorContext);

    const bmadContext: BMADSessionContext = {
      projectPath: projectRoot,
      storyId: storyKey,
    };

    // Accumulated agent output across turns, threaded into every Track 2 record
    // so a non-interactive session (zero supervisor interactions) is not blank.
    const outputs: string[] = [];
    const recordExchange = (
      status: ExchangeFrontMatter['status'],
      sessionId: string,
      output?: string,
      commit?: string,
    ): Promise<void> =>
      writeExchangeRecord(deps, {
        sessionId,
        storyId: storyKey,
        sprintId: epicId,
        command,
        startedAt,
        status,
        output: output ?? outputs.join('\n'),
        commit,
      });

    // Evidence-gate baseline: snapshot already-dirty paths BEFORE the session so
    // the gate counts only NEW source changes. Otherwise a file left dirty by a
    // prior/failed run (or a dirty checkout) would satisfy the gate on its own,
    // letting a plan-only dev-story advance the story on fiction.
    const evidenceBaseline =
      deps.workspaceInspection && shouldHaveCodeChanges(command)
        ? new Set(await deps.workspaceInspection.changedPaths(projectRoot))
        : new Set<string>();

    let handle: SessionHandle;
    try {
      handle = await deps.sessionPort.startSession(command, bmadContext);
    } catch (error) {
      const result = {
        success: false,
        escalated: true,
        note: error instanceof Error ? error.message : String(error),
      };
      await recordExchange('failed', '', result.note);
      return result;
    }

    // Re-wire supervisor context with real sessionId for log correlation.
    deps.supervisorService.setWorkflowContext(
      command,
      storyKey,
      supervisorContext,
      handle.sessionId,
    );

    let lastTurn: SessionTurnResult = handle.firstTurn;

    if (lastTurn.error === true) {
      const result = {
        success: false,
        escalated: true,
        note: lastTurn.errorMessage ?? lastTurn.output ?? 'session error',
      };
      await recordExchange('failed', handle.sessionId);
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
        await recordExchange('failed', handle.sessionId);
        return result;
      }
      if (lastTurn.output.length > 0) outputs.push(lastTurn.output);
      if (lastTurn.error === true) {
        const result = {
          success: false,
          escalated: true,
          note: lastTurn.errorMessage ?? lastTurn.output ?? 'session error',
        };
        await recordExchange('failed', handle.sessionId);
        return result;
      }
    }

    if (!lastTurn.completed) {
      const result = {
        success: false,
        escalated: true,
        note: 'session did not complete within follow-up budget',
      };
      await recordExchange('escalated', handle.sessionId);
      return result;
    }

    // Evidence gate (2026-06-22 post-mortem): a code-producing command must
    // actually change source files. If the session only planned, drive
    // corrective "implement now" continuations; if still nothing changed, block
    // rather than advance the story on a self-reported (fictional) success.
    if (deps.workspaceInspection && shouldHaveCodeChanges(command)) {
      const maxAttempts = deps.maxImplementationRetries ?? DEFAULT_MAX_IMPLEMENTATION_RETRIES;
      // Only NEW non-bookkeeping paths (not in the pre-session baseline) count.
      const hasFreshImpl = (paths: string[]): boolean =>
        hasImplementationChanges(paths.filter((p) => !evidenceBaseline.has(p)));
      let changedPaths = await deps.workspaceInspection.changedPaths(projectRoot);
      let attempts = 0;
      while (!hasFreshImpl(changedPaths) && attempts < maxAttempts) {
        attempts++;
        try {
          lastTurn = await deps.sessionPort.continueSession(handle.sessionId, IMPLEMENT_NOW_PROMPT);
        } catch (error) {
          await recordExchange('failed', handle.sessionId);
          return {
            success: false,
            escalated: true,
            note: error instanceof Error ? error.message : String(error),
          };
        }
        if (lastTurn.output.length > 0) outputs.push(lastTurn.output);
        if (lastTurn.error === true) {
          await recordExchange('failed', handle.sessionId);
          return {
            success: false,
            escalated: true,
            note: lastTurn.errorMessage ?? lastTurn.output ?? 'session error',
          };
        }
        changedPaths = await deps.workspaceInspection.changedPaths(projectRoot);
      }
      if (!hasFreshImpl(changedPaths)) {
        await recordExchange('failed', handle.sessionId);
        return {
          success: false,
          escalated: true,
          note: `no source changes after ${command} (${maxAttempts} corrective attempt(s)) — refusing to mark done`,
        };
      }
    }

    const joined = outputs.join('\n');

    // DoD completion gate (ADR-020): the verification (ADR-016) and
    // review-verdict gates are now declarative `DoDCheck`s resolved by id
    // through the registry. A single `evaluate` replaces the two inline
    // if-blocks; the verdict — and the blocking note — is byte-identical (the
    // first failure's detail is the historical gate note). The evidence-retry
    // loop above is intentionally NOT folded in here (it drives the session).
    // Enforced iamthelaw checks (fiche 0014) extend the built-in criteria. A
    // `check` matching a registered DoDCheck is enforced; an unknown id is
    // skipped by `DoDService.evaluate` (custom checks beyond the built-in
    // registry are a documented follow-up — not invented here).
    const criteria = dedupe([...DEFAULT_DOD_CRITERIA, ...enforcedChecks]);
    const dod = await dodService.evaluate(
      { projectRoot, command, storyKey, agentOutput: joined },
      criteria,
      dodRegistry,
    );
    if (!dod.passed) {
      auditCheckViolations(dod.failures, ruleSet, auditSink);
      // Surface the failed criteria to the web mission-control (fiche 0016).
      // `runId` is injected downstream by the run's TaggingEventBus, not here.
      deps.eventBus?.emit('dod.check.failed', {
        storyKey,
        command,
        failures: dod.failures,
        ts: new Date().toISOString(),
      });
      await recordExchange('failed', handle.sessionId);
      return { success: false, escalated: true, note: dodFailureNote(dod.failures) };
    }

    const nextStatus = inferNextStatus(command);

    // Commit anchor (EA14-S3): after a code-producing command is verified done,
    // commit the work as a durable rollback unit and record the SHA in Track 2.
    // Opt-in via the injected port (auto-commit blast radius). Best-effort.
    let commitSha: string | undefined;
    if (deps.commitAnchor && shouldHaveCodeChanges(command)) {
      commitSha =
        (await deps.commitAnchor.commit(projectRoot, commitAnchorMessage(storyKey, command))) ??
        undefined;
    }

    await recordExchange('success', handle.sessionId, undefined, commitSha);

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
    /** Agent session output / failure note — keeps Track 2 non-blank for
     * non-interactive sessions (zero supervisor interactions). */
    output?: string;
    /** Commit-anchor SHA, when the runner committed the verified work. */
    commit?: string;
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
      ...(meta.commit ? { commit: meta.commit } : {}),
    };
    await deps.exchangeHistoryWriter.write({ frontMatter, interactions, agentOutput: meta.output });
  } catch (err) {
    // Best-effort — do not let Track 2 write failure break the session.
    console.warn(
      '[EA14-S2] Failed to write exchange history:',
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Blocking note for a failed DoD evaluation. The first failure's `detail` is
 * the historical gate note (verification summary / review-verdict note), kept
 * byte-identical so the golden behaviour is preserved. Falls back to a combined
 * summary only if a check failed without a detail (shouldn't happen for the
 * built-in checks).
 */
function dodFailureNote(failures: { id: string; detail?: string }[]): string {
  const first = failures[0];
  if (first?.detail) return first.detail;
  return `DoD not satisfied: ${failures.map((f) => f.detail ?? f.id).join('; ')}`;
}

/** Stable de-duplication preserving first-occurrence order. */
function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Audit DoD failures attributable to an enforced iamthelaw `check` rule
 * (fiche 0014). For each failed criterion that some rule opted into via
 * `check`, append a `violated` history entry crediting that rule. Best-effort:
 * an audit-write throw is swallowed so it never breaks the run. Failures of the
 * built-in criteria (no owning `check` rule) are skipped.
 */
function auditCheckViolations(
  failures: DoDFailure[],
  ruleSet: RuleSet,
  auditSink: (entry: HistoryEntry) => void,
): void {
  const rulesByCheck = indexRulesByCheck(ruleSet);
  const added_at = new Date().toISOString();
  for (const failure of failures) {
    for (const rule of rulesByCheck.get(failure.id) ?? []) {
      try {
        auditSink({
          id: rule.id,
          added_at,
          added_by: 'orchestrator',
          source: rule.source,
          rationale: failure.detail ?? `DoD check '${failure.id}' not satisfied`,
          status: 'violated',
        });
      } catch {
        // Best-effort audit — never let a write failure break the run.
      }
    }
  }
}

/** An empty rule set — the safe fallback when a project has (or fails to load) rules. */
function emptyRuleSet(): RuleSet {
  return { global: [], scrum: [], architecture: [], agents: {} };
}

/** Map each enforced `check` id to the rules (any group) that opted into it. */
function indexRulesByCheck(ruleSet: RuleSet): Map<string, Rule[]> {
  const index = new Map<string, Rule[]>();
  for (const rule of flattenRules(ruleSet)) {
    if (!rule.check) continue;
    const existing = index.get(rule.check);
    if (existing) existing.push(rule);
    else index.set(rule.check, [rule]);
  }
  return index;
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
