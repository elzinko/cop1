# Story EA9.4: BMADSessionStep

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **cop1 SprintRunner**,
I want a configurable `BMADSessionStep` WorkflowStep that drives a multi-turn BMAD workflow via `BMADSessionPort` and routes intercepted questions through `SupervisorService`,
so that dev-story, code-review, and QA phases run as stateful Agent SDK sessions instead of single-shot `claude -p` calls, while preserving the existing retry/budget/event semantics of `BMADCommandStep`.

## Acceptance Criteria

1. **AC1 — `BMADSessionStep` class implements `WorkflowStep`**
   - New file `packages/sprint-core/src/features/bmad-orchestration/application/BMADSessionStep.ts`
   - Implements `WorkflowStep` from `features/workflow/domain/WorkflowStep.ts` (`name: string`, `run(context: WorkflowContext): Promise<StepResult>`)
   - Constructor signature: `constructor(sessionPort: BMADSessionPort, supervisorService: SupervisorService, options: BMADSessionStepOptions)`
   - Exported via `@cop1/sprint-core` barrel (`packages/sprint-core/src/index.ts`)

2. **AC2 — Configurable via `BMADSessionStepOptions`**
   - `BMADSessionStepOptions` exported type with fields:
     - `name: string` (e.g., `'bmad-dev'`, `'bmad-review'`, `'bmad-qa'`) — drives `step.name`
     - `command: string` — the BMAD slash command or workflow identifier (e.g., `'/bmad-bmm-dev-story'`, `'/bmad-bmm-code-review'`, `'/bmad-bmm-qa-automate'`)
     - `errorPrefix: string` — prefix used when returning `StepResult { status: 'failed' }` (e.g., `'BMAD dev-story failed'`)
     - `retryPolicy?: RetryPolicy` — reuses the existing `RetryPolicy` from `domain/RetryPolicy.ts` (default: `new RetryPolicy()`)
     - `budgetChecker?: BudgetChecker` — reuses the existing interface from `BMADCommandStep.ts` (re-exported or moved to a shared location — see AC6)
     - `eventBus?: EventBus` — structured retry/session event emission
     - `delayFn?: (ms: number) => Promise<void>` — injectable for tests
   - No abstract class needed: `BMADSessionStep` is a concrete class configured by options (per ADR-012 §6.4). `BMADDevStoryStep` / `BMADReviewStep` / `BMADQAStep` remain untouched in this story (EA9-S5 will replace their instantiation in `PipelineStepFactory`).

3. **AC3 — Session lifecycle via `BMADSessionPort`**
   - Pre-flight budget check: if `budgetChecker.getBudgetStatus().remaining <= 0`, return `{ status: 'blocked', error: BudgetExhaustedError(...) }` (identical semantics to `BMADCommandStep.run()`).
   - Build `BMADSessionContext`:
     - `projectPath` = `context.projectPath`
     - `storyId` = `context.storyId`
     - `metadata` = `{ storyContent: context.storyContent ?? ''  }` (or equivalent — whatever fields `BMADSessionContext` exposes; see `packages/sprint-core/src/features/bmad-orchestration/domain/ports/BMADSessionPort.ts`). Do NOT add new fields to the port interface.
   - Wire the supervisor BEFORE starting the session:
     - Build a `SupervisorContext` (from `SupervisorLLMPort.ts`) with `workflowCommand` = this step's `command`, `storyId` = `context.storyId`, `storyContent` = `context.storyContent ?? ''`, empty `projectContext`/`architectureRules`/`iamtheLawRules` (these are populated by enrichment in a later story — stub to empty strings now), empty `sessionHistory`, and `currentQuestion` = `''`.
     - Call `supervisorService.setWorkflowContext(command, storyId, supervisorContext, sessionId?)`. Because `sessionId` is only known AFTER `startSession()` returns, call `setWorkflowContext` twice: once before `startSession()` (without sessionId, to wire command/story/context for the `QuestionHandler`), and once again immediately after `startSession()` with the real `sessionHandle.sessionId`. Document this two-step wiring in a code comment.
   - Ensure the `BMADSessionPort` adapter (`AgentSdkSessionAdapter`) was constructed in composition root with `questionHandler = supervisorService.createQuestionHandler()`. `BMADSessionStep` does NOT construct the adapter; it only consumes it. This is explicitly called out in `BMADSessionStepOptions` / class docstring so EA9-S5 wiring is unambiguous.
   - Call `sessionPort.startSession(this.command, bmadSessionContext)` → `SessionHandle`.
   - Drive the multi-turn loop: BMAD workflows are self-driving once a session starts (Agent SDK runs up to `maxTurns` internally and returns when the workflow completes or errors). Therefore the step does NOT call `continueSession()` in a loop in V1 — the first turn is expected to carry the complete execution. **However**, the step MUST handle the case `firstTurn.completed === false` by calling `continueSession(sessionId, 'C')` in a bounded loop (max 3 follow-ups) to nudge the workflow forward. If still not completed, return `failed` with `errorPrefix + ': session did not complete within follow-up budget'`.

4. **AC4 — Result mapping to `StepResult`**
   - If the final `SessionTurnResult.error === true` (or the loop ends without `completed`): return `{ status: 'failed', error: new Error(\`${errorPrefix}: ${errorMessage ?? output.slice(0, 500)}\`) }`.
   - If the final turn returns `completed === true` and `error !== true`: return `{ status: 'ok', report: finalOutput }` where `finalOutput` is the concatenation (or last non-empty) of `output` fields observed across all turns in this step invocation.
   - If any thrown error is a `BudgetExhaustedError`: return `{ status: 'blocked', error }`.
   - All other thrown errors: wrap as `{ status: 'failed', error: Error }`.
   - **Retry policy**: BMAD session errors that are classified as transient (by `RetryPolicy.isTransientError(errorMessage)`) trigger a retry of the ENTIRE session — i.e., a new `startSession()` call. Apply the same `retryPolicy.maxRetries`, delays via `delayFn`, and emit `bmad.retry.attempt` / `bmad.retry.transient` events exactly as `BMADCommandStep` does. On exhaustion, throw `BMADRetryExhaustedError`. Do NOT retry mid-session via `continueSession`.

5. **AC5 — Event emission**
   - On every retry: emit `bmad.retry.attempt` and `bmad.retry.transient` via `eventBus` (same payload shape as `BMADCommandStep`).
   - Session-level events (`session.started`, `session.turn.completed`, `session.workflow.completed`, `session.workflow.failed`) are already emitted by `AgentSdkSessionAdapter` — do NOT re-emit them from `BMADSessionStep`.
   - Do NOT introduce new event types in this story.

6. **AC6 — Share `BudgetChecker` interface**
   - Move (or re-export) the `BudgetChecker` interface currently defined in `BMADCommandStep.ts` so that `BMADSessionStep.ts` can import it without creating a circular dep.
   - Acceptable options (pick ONE):
     1. Extract `BudgetChecker` to `packages/sprint-core/src/features/bmad-orchestration/application/BudgetChecker.ts` and re-export from both `BMADCommandStep.ts` (for back-compat) and `BMADSessionStep.ts`.
     2. OR: leave `BudgetChecker` in `BMADCommandStep.ts` and import it from there in `BMADSessionStep.ts` (no circular — `BMADSessionStep` does NOT import `BMADCommandStep` itself).
   - Whichever option chosen, do NOT duplicate the interface definition.

7. **AC7 — Unit tests**
   - New test file: `packages/sprint-core/src/features/bmad-orchestration/__tests__/BMADSessionStep.test.ts`
   - Uses `InMemorySessionAdapter` (from `infrastructure/`) as the `BMADSessionPort` mock.
   - Uses `InMemorySupervisorAdapter` (from `infrastructure/`) + real `SupervisorService` + a mock `SessionLogger` (or lightweight in-memory `SessionLogger` with a mock `StructuredLogger`).
   - Test cases (at least 10):
     1. `run()` with happy-path single-turn completion returns `{ status: 'ok', report }`
     2. `run()` with multi-turn: first turn not completed → 1 follow-up with 'C' → completed
     3. `run()` exceeds follow-up budget (3) → returns `failed` with errorPrefix
     4. `run()` with session error (`turn.error === true`) → returns `failed` with errorPrefix
     5. `run()` with transient error + retry policy → retries and succeeds on 2nd attempt
     6. `run()` with transient error exhausting retries → throws `BMADRetryExhaustedError` → caught and returned as `failed`
     7. `run()` with non-transient error → no retry, returns `failed` immediately
     8. Pre-flight budget check (`remaining <= 0`) → returns `blocked` with `BudgetExhaustedError`, does NOT call `startSession`
     9. Mid-retry budget check (`remaining <= 0` between attempts) → returns `blocked`
     10. `setWorkflowContext` is called on `SupervisorService` with correct `command`, `storyId`, and real `sessionId` (verified via spy/mock) BEFORE any follow-up turn
     11. Event emission: `bmad.retry.attempt` fires on retry
     12. `name`, `command`, `errorPrefix` are taken from options (parametric test across the three configurations: dev / review / qa)
   - Target: all new tests green, no regressions in existing `bmad-orchestration` tests.

8. **AC8 — Barrel exports & quality gates**
   - `packages/sprint-core/src/index.ts` exports `BMADSessionStep` (class) and `BMADSessionStepOptions` (type).
   - `pnpm typecheck` passes (pre-existing TS6310/budget errors acceptable — document any carry-over in Dev Notes if they appear).
   - `pnpm lint` passes.
   - `pnpm test --filter @cop1/sprint-core` passes (baseline before this story: 680/681 with 1 pre-existing failure in `PipelineStepFactory` — that failure is acceptable, new code must not add regressions).
   - Do NOT modify `PipelineStepFactory.ts` in this story — that wiring belongs to EA9-S5.
   - Do NOT delete `BMADDevStoryStep.ts` / `BMADReviewStep.ts` / `BMADQAStep.ts` — they coexist with `BMADSessionStep` until EA9-S5 migration.

## Tasks / Subtasks

- [x] Task 1 — Extract/locate `BudgetChecker` (AC: #6)
  - [x] Chose option 2: import `BudgetChecker` from `BMADCommandStep.ts` (no circular dep — `BMADSessionStep` does not import `BMADCommandStep` runtime values, only the type)
  - [x] Verified no circular imports

- [x] Task 2 — Implement `BMADSessionStep` (AC: #1, #2, #3, #4, #5)
  - [x] Created `packages/sprint-core/src/features/bmad-orchestration/application/BMADSessionStep.ts`
  - [x] Defined `BMADSessionStepOptions` type
  - [x] Constructor `(sessionPort, supervisorService, options)`
  - [x] `run(context)` with pre-flight budget, two-step `setWorkflowContext` wiring, follow-up loop (max 3), output aggregation
  - [x] Retry wrapper mirroring `BMADCommandStep.executeWithRetry` (events, delay, transient classification, `BMADRetryExhaustedError`)
  - [x] `BudgetExhaustedError` → `blocked`

- [x] Task 3 — Barrel exports (AC: #1, #8)
  - [x] Exported `BMADSessionStep` and `BMADSessionStepOptions` from `packages/sprint-core/src/index.ts`

- [x] Task 4 — Unit tests (AC: #7)
  - [x] Created `BMADSessionStep.test.ts` with 14 tests covering all 12 AC7 cases (parametric counts as 3)
  - [x] Uses `InMemorySessionAdapter`, real `SupervisorService` with `InMemorySupervisorAdapter` + mock `SessionLogger`
  - [x] No regressions in existing `bmad-orchestration` tests (188/188 passing)

- [x] Task 5 — Quality gates (AC: #8)
  - [x] `pnpm typecheck` — no NEW errors introduced (pre-existing carry-overs documented)
  - [x] No `lint` script in package — N/A
  - [x] `pnpm vitest run packages/sprint-core/src/features/bmad-orchestration` — 188/188 green
  - [x] Updated Dev Agent Record below

## Dev Notes

### Architecture Context

`BMADSessionStep` is the V1 replacement for `BMADDevStoryStep` / `BMADReviewStep` / `BMADQAStep` described in ADR-012 §6.4. In this story, it is **added alongside** the existing steps — the actual wiring swap in `PipelineStepFactory` happens in EA9-S5. This separation keeps the PR small and isolates the factory migration behind an integration test (EA9-S5).

```
SprintRunner
  └── WorkflowEngine
        └── WorkflowStep (unchanged interface)
              └── BMADSessionStep (NEW — this story)
                    ├── BMADSessionPort.startSession(command, context)  ← drives the Agent SDK session
                    │     └── AgentSdkSessionAdapter
                    │           └── canUseTool → QuestionHandler → SupervisorService.respond()
                    └── SupervisorService.setWorkflowContext(...) ← wires command/story/sessionId
```

The `SupervisorService.createQuestionHandler()` returned callback is injected into `AgentSdkSessionAdapter` at **composition root time**, not inside `BMADSessionStep`. The step only sees the `BMADSessionPort` abstraction. The responsibility of `BMADSessionStep` with respect to the supervisor is limited to calling `setWorkflowContext(...)` at the right moments so that when the adapter routes a question back, the supervisor knows which command/story/session it concerns.

### Dependencies Consumed (all done)

**From EA9-S1:**
- `BMADSessionPort`, `BMADSessionContext`, `SessionHandle`, `SessionTurnResult`, `QuestionHandler` — [Source: packages/sprint-core/src/features/bmad-orchestration/domain/ports/BMADSessionPort.ts]
- `AgentSdkSessionAdapter` — [Source: packages/sprint-core/src/features/bmad-orchestration/infrastructure/AgentSdkSessionAdapter.ts]
- `InMemorySessionAdapter` (test fixture) — [Source: packages/sprint-core/src/features/bmad-orchestration/infrastructure/InMemorySessionAdapter.ts]

**From EA9-S2:**
- `SupervisorLLMPort`, `SupervisorContext`, `SupervisorQuestion`, `SupervisorResponse` — [Source: packages/sprint-core/src/features/bmad-orchestration/domain/ports/SupervisorLLMPort.ts]
- `InMemorySupervisorAdapter` (test fixture) — [Source: packages/sprint-core/src/features/bmad-orchestration/infrastructure/InMemorySupervisorAdapter.ts]

**From EA9-S3:**
- `SupervisorService`, `DeterministicPattern`, `SupervisorService.createQuestionHandler()`, `SupervisorService.setWorkflowContext(command, storyId, context, sessionId?)` — [Source: packages/sprint-core/src/features/bmad-orchestration/application/SupervisorService.ts]
- `SessionLogger`, `SessionInteraction`, `deriveEpicId` — [Source: packages/sprint-core/src/features/bmad-orchestration/application/SessionLogger.ts]
- `SessionHistoryReader` — [Source: packages/sprint-core/src/features/bmad-orchestration/application/SessionHistoryReader.ts]

**From existing BMAD orchestration infrastructure (EA1):**
- `RetryPolicy` — [Source: packages/sprint-core/src/features/bmad-orchestration/domain/RetryPolicy.ts]
- `BudgetExhaustedError` — [Source: packages/sprint-core/src/features/bmad-orchestration/domain/errors/BudgetExhaustedError.ts]
- `BMADRetryExhaustedError` — [Source: packages/sprint-core/src/features/bmad-orchestration/domain/errors/BMADRetryExhaustedError.ts]
- `BudgetChecker` interface — [Source: packages/sprint-core/src/features/bmad-orchestration/application/BMADCommandStep.ts]
- Pattern reference: `BMADCommandStep.run()` / `BMADCommandStep.executeWithRetry()` — mirror the retry + event + budget logic

### Critical Pattern — Mirror `BMADCommandStep` for Retry/Budget

The existing `BMADCommandStep` in `application/BMADCommandStep.ts` already implements:
- Pre-flight + per-retry budget check
- Retry loop with transient classification via `RetryPolicy.isTransientError()`
- Event emission (`bmad.retry.attempt`, `bmad.retry.transient`)
- `BMADRetryExhaustedError` on exhaustion
- `BudgetExhaustedError` → `{ status: 'blocked' }`

**Do not re-invent these semantics.** The new step must produce identical observable behavior so that the retry/budget tests for BMAD workflows remain conceptually valid. Read `BMADCommandStep.executeWithRetry()` lines 98–157 as the reference implementation.

**Do not extract a shared base class** in this story — that refactor is out of scope and would couple the `BMADSessionPort` and `BMADCommandPort` abstractions prematurely. Copy the retry/budget logic into `BMADSessionStep` verbatim (inlined), even if it means ~50 lines of structural duplication. Rationale: EA9-S5 will delete `BMADDevStoryStep`/`BMADReviewStep`/`BMADQAStep`, at which point the duplication evaporates.

### Session Follow-up Loop Rationale

Agent SDK sessions driven via `AgentSdkSessionAdapter.startSession()` normally complete in a single `query()` invocation — the SDK runs up to `maxTurns` internally. However, edge cases can return `completed: false` without an error (e.g., the workflow paused awaiting a "proceed" signal that the Agent SDK did not model as `AskUserQuestion`). To keep the step robust without introducing heuristic parsing:

- Max 3 follow-up turns via `continueSession(sessionId, 'C')`
- Each follow-up result is checked for `completed` / `error`
- After 3 follow-ups still not `completed` → `failed` with `errorPrefix + ': session did not complete within follow-up budget'`

**Do NOT** try to detect pending questions via output parsing. Questions are expected to be routed via `canUseTool` → `SupervisorService`, not via output heuristics. The follow-up loop is strictly a safety net.

### SupervisorContext Population (V1 stubs)

For this story, `storyContent` comes from `WorkflowContext.storyContent ?? ''`. The fields `projectContext`, `architectureRules`, `iamtheLawRules` are stubbed to empty strings. Enriching them with real content (project-context.md, architecture.md, iamthelaw rules sidecar) is explicitly out of scope — it will be handled later, likely in an EA9 follow-up story or via `StoryContextBuilder` enrichment. The supervisor will still function via its deterministic patterns + LLM fallback using only `storyContent`.

### Project Structure

```
packages/sprint-core/src/features/bmad-orchestration/
├── __tests__/
│   ├── (existing tests unchanged)
│   └── BMADSessionStep.test.ts                    ← NEW
├── application/
│   ├── BMADCommandStep.ts                         ← unchanged (may re-export BudgetChecker)
│   ├── BMADDevStoryStep.ts                        ← unchanged (replaced in EA9-S5)
│   ├── BMADReviewStep.ts                          ← unchanged (replaced in EA9-S5)
│   ├── BMADQAStep.ts                              ← unchanged (replaced in EA9-S5)
│   ├── BMADSessionStep.ts                         ← NEW
│   ├── BudgetChecker.ts                           ← NEW (only if AC6 option 1 is chosen)
│   ├── SessionHistoryReader.ts                    ← unchanged (EA9-S3)
│   ├── SessionLogger.ts                           ← unchanged (EA9-S3)
│   └── SupervisorService.ts                       ← unchanged (EA9-S3)
├── domain/
│   └── (unchanged)
└── infrastructure/
    └── (unchanged)
```

`packages/sprint-core/src/index.ts` — add two new exports (class + options type). Do NOT touch any other exports.

### Project Structure Alignment

- **Naming**: `BMADSessionStep` (PascalCase class, PascalCase file name — consistent with `BMADCommandStep` / `BMADDevStoryStep`)
- **Layer**: `application/` — correct per hexagonal (it consumes `BMADSessionPort` from `domain/ports/`)
- **Pattern**: `WorkflowStep` implementation — same as existing BMAD steps
- **Events**: dot-notation reuse (`bmad.retry.attempt`, `bmad.retry.transient`) — no new event types
- **Error pattern**: returns `StepResult` with typed `error: Error`, consistent with `BMADCommandStep`
- **No new architecture decisions** — this story is purely an implementation of the ADR-012 design

### Testing Standards

- Vitest, monorepo convention `*.test.ts` under `__tests__/`
- Use `beforeEach`/`afterEach` with no filesystem setup needed (all in-memory)
- Inject fake timers / `delayFn = async () => {}` to avoid real delays during retry tests
- Mock the `EventBus` with a simple `{ emit: vi.fn() }` or use the existing `InMemoryEventBus` from `@cop1/shared-kernel` if available
- Do NOT call the real Agent SDK — always use `InMemorySessionAdapter`

### References

- [Source: _bmad-output/planning-artifacts/adr-012-multi-turn-bmad-interaction.md — §4.1 Architecture Overview, §6.2 New Components, §6.3 Modified Components, §6.4 Composition Root Changes, §11.1 Hexagonal Respect]
- [Source: _bmad-output/planning-artifacts/epics.md — Epic EA9, Story EA9-S4 definition and DoD]
- [Source: _bmad-output/implementation-artifacts/EA9-S1.md — Done: BMADSessionPort + AgentSdkSessionAdapter]
- [Source: _bmad-output/implementation-artifacts/EA9-S2.md — Done: SupervisorLLMPort + AgentSdkSupervisorAdapter + InMemorySupervisorAdapter]
- [Source: _bmad-output/implementation-artifacts/EA9-S3.md — Done: SupervisorService + SessionLogger + SessionHistoryReader]
- [Source: packages/sprint-core/src/features/bmad-orchestration/application/BMADCommandStep.ts — reference implementation for retry/budget/event pattern]
- [Source: packages/sprint-core/src/features/bmad-orchestration/domain/ports/BMADSessionPort.ts — port interface to consume]
- [Source: packages/sprint-core/src/features/bmad-orchestration/application/SupervisorService.ts — `setWorkflowContext()` and `createQuestionHandler()`]
- [Source: packages/sprint-core/src/features/bmad-orchestration/infrastructure/InMemorySessionAdapter.ts — test fixture]
- [Source: packages/sprint-core/src/features/bmad-orchestration/domain/RetryPolicy.ts — `isTransientError()` classifier]
- [Source: packages/sprint-core/src/features/workflow/domain/WorkflowStep.ts — `WorkflowStep` interface]
- [Source: packages/sprint-core/src/features/workflow/domain/WorkflowContext.ts — `WorkflowContext` shape]
- [Source: packages/sprint-core/src/features/workflow/domain/StepResult.ts — `StepResult` shape]
- [Source: _bmad-output/project-context.md — Implementation rules and repo conventions]

## Dev Agent Record

### Agent Model Used

claude-opus-4-6 (1M context)

### Debug Log References

- `pnpm vitest run packages/sprint-core/src/features/bmad-orchestration` → 18 files / 188 tests passing (incl. 14 new BMADSessionStep tests)
- `pnpm typecheck` → no NEW errors from BMADSessionStep; pre-existing TS errors in unrelated test files (missing `budget` field in test `Cop1Config` literals, `AgentSdkSessionAdapter` `CanUseTool` typing, `SessionLogger` mock) carry over unchanged

### Completion Notes List

- `BMADSessionStep` implemented as a concrete `WorkflowStep` configured via `BMADSessionStepOptions` (per ADR-012 §6.4 — no abstract base).
- Mirrored `BMADCommandStep.executeWithRetry()` retry/budget/event semantics inline (per Dev Notes — no shared base class extracted; will collapse in EA9-S5 when legacy steps are deleted).
- Two-step `setWorkflowContext` wiring documented in code: once before `startSession()` (covers question intercepts on the first turn) and once after, with the real `sessionId` for log correlation.
- AC6 chose option 2: `BudgetChecker` interface imported as a `type` from `BMADCommandStep.ts` — no extraction needed, no circular dep (BMADSessionStep does not import BMADCommandStep at runtime).
- Follow-up loop bounded to 3 turns sending `'C'`; on overflow returns `failed` with `errorPrefix + ': session did not complete within follow-up budget'`. No output heuristic parsing — questions still flow through `canUseTool`.
- Session-level events (`session.started`, etc.) are NOT re-emitted (already emitted by `AgentSdkSessionAdapter`). Only `bmad.retry.attempt` / `bmad.retry.transient` are emitted by the step itself.
- `PipelineStepFactory.ts` and the legacy `BMADDevStoryStep`/`BMADReviewStep`/`BMADQAStep` files are intentionally untouched — EA9-S5 will perform the wiring swap.
- Test fixtures use a stub `BudgetStatus` (with `breakdownByCommand: {}`, `breakdownByAgent: {}`) and cast `Cop1Config` via `as unknown as Cop1Config` to avoid coupling the new test to unrelated pre-existing config drift.

### Code Review Fixes (2026-04-06)

Adversarial review surfaced one HIGH and three MEDIUM issues, all fixed:

- **H1 fixed — Adapter-thrown exceptions now flow through retry loop.** `runSession` wraps both `sessionPort.startSession()` and `sessionPort.continueSession()` in try/catch, returning `{ kind: 'failure', errorMessage }` so transient thrown errors (network, SDK init) are classified by `RetryPolicy.isTransientError()` and retried like turn-level errors. Previously such errors bypassed retry entirely and landed in `run()`'s outer catch.
- **M1 fixed — `setWorkflowContext` re-wire only after confirming live session.** Re-wire with real `sessionId` now happens AFTER the first-turn error check, not before, so failed sessions no longer produce a spurious log-correlation wire-up.
- **M2 fixed — Empty-output sessions return `failed`.** A completed session whose concatenated outputs are all empty strings now returns `{ kind: 'failure', errorMessage: 'session completed with empty output' }` instead of silently succeeding with an empty `report`. Also switched `??` → `||` on errorMessage fallbacks so empty-string output properly falls through.
- **M3 fixed — Tests now verify ordering of first `setWorkflowContext` vs `startSession`** using `vi.spyOn` + `invocationCallOrder`, protecting AC3's "call before startSession" mandate from silent regression.
- **L1/L2 fixed — Aggregation polish.** `outputs.push(lastTurn.output)` now guarded by `output.length > 0`; final `outputs.join('\n')` drops the ambiguous `||` fallback.

Four new unit tests added covering: thrown transient error at `startSession` (retries + succeeds), thrown error at `continueSession` (returns failed with prefix), empty-output session (returns failed), and ordering of supervisor wire-up before `startSession`. Total BMADSessionStep tests: 18 (was 14). Full `bmad-orchestration` suite: 192/192 passing (was 188).

### File List

- `packages/sprint-core/src/features/bmad-orchestration/application/BMADSessionStep.ts` (new)
- `packages/sprint-core/src/features/bmad-orchestration/__tests__/BMADSessionStep.test.ts` (new)
- `packages/sprint-core/src/index.ts` (modified — barrel exports)
- `_bmad-output/implementation-artifacts/EA9-S4.md` (modified — task checkboxes, status, dev agent record)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — EA9-S4 status transition)
