# Story EA9.5: PipelineStepFactory migration to BMADSessionStep

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **cop1 composition root**,
I want `PipelineStepFactory` to instantiate the new multi-turn `BMADSessionStep` (with a wired `AgentSdkSessionAdapter` + `SupervisorService`) instead of the legacy single-shot `BMADDevStoryStep` / `BMADReviewStep` / `BMADQAStep`,
so that `SprintRunner`, when `workflow.useBMAD === true`, drives BMAD dev-story / code-review / QA phases through stateful Agent SDK sessions end-to-end, completing the EA9 multi-turn pivot from ADR-012.

## Acceptance Criteria

1. **AC1 — `PipelineStepFactory.buildBMADSteps()` returns three `BMADSessionStep` instances**
   - File: `packages/app/src/composition/PipelineStepFactory.ts`
   - The BMAD branch returns exactly three `BMADSessionStep` instances configured for dev / review / qa, in that order, replacing the current `[BMADDevStoryStep, BMADReviewStep, BMADQAStep]` triple.
   - Each `BMADSessionStep` is constructed with `(sessionPort, supervisorService, options)` per `BMADSessionStepOptions`.
   - The dev / review / qa configurations use the same `command` strings as the legacy steps (look up the actual values in `BMADDevStoryStep.ts`, `BMADReviewStep.ts`, `BMADQAStep.ts` — do NOT guess; copy verbatim, e.g., `/bmad-bmm-dev-story`, `/bmad-bmm-code-review`, `/bmad-bmm-qa-automate` or whatever the legacy classes actually pass).
   - Step `name` values are `'bmad-dev'`, `'bmad-review'`, `'bmad-qa'`.
   - `errorPrefix` values are `'BMAD dev-story failed'`, `'BMAD code-review failed'`, `'BMAD QA failed'` (or whatever prefixes the legacy steps already use — match them exactly so existing log/event consumers do not break).

2. **AC2 — Composition root wires `BMADSessionPort` + `SupervisorService` once**
   - `PipelineStepFactory` constructor accepts the new collaborators required for session-mode pipelines. Two acceptable shapes (pick ONE, document choice in Dev Notes):
     - **Option A (preferred)**: extend the constructor to accept an optional `sessionPort?: BMADSessionPort` and `supervisorService?: SupervisorService`. When `workflow.useBMAD === true`, BOTH must be present or `buildBMADSteps()` throws a clear error: `'BMADSessionPort and SupervisorService are required when workflow.useBMAD is true'`. The legacy `commandPort?: BMADCommandPort` parameter is REMOVED (it is no longer used by any code path).
     - **Option B**: keep `commandPort` for backward compat but mark it deprecated and ignored when `useBMAD` is true. Strongly discouraged — choose only if removing it breaks unrelated callers that this story should not touch.
   - Update `packages/app/src/cli/commands/sprint-run.ts` so it constructs:
     - `eventBus`
     - `supervisorAdapter` = `new AgentSdkSupervisorAdapter(...)` (use defaults; if the constructor requires a query function, use the SDK default per existing test wiring in `AgentSdkSupervisorAdapter.test.ts`)
     - `sessionLogger` = `new SessionLogger(structuredLogger)` where `structuredLogger` is the existing logger used elsewhere in the daemon, OR a minimal stub if no structured logger is wired in `sprint-run.ts` today (document the choice; do NOT introduce a new logging stack)
     - `supervisorService` = `new SupervisorService(supervisorAdapter, sessionLogger, /* deterministic patterns */ [])`
     - `questionHandler` = `supervisorService.createQuestionHandler()`
     - `sessionPort` = `new AgentSdkSessionAdapter({ questionHandler, eventBus, ...defaults })`
     - Pass `sessionPort` and `supervisorService` into `new PipelineStepFactory(eventBus, { sessionPort, supervisorService })` (or whichever shape AC2 Option A defines).
   - The wiring must happen exactly ONCE in `sprint-run.ts` so that all three `BMADSessionStep` instances share the same `sessionPort` + `supervisorService` (and therefore the same `SessionLogger` / supervisor history).
   - Do NOT instantiate adapters inside `PipelineStepFactory` itself — composition root stays in the CLI command per ADR-012 §6.4 and existing repo conventions.

3. **AC3 — Legacy step files removed (or quarantined)**
   - Delete `packages/sprint-core/src/features/bmad-orchestration/application/BMADDevStoryStep.ts`, `BMADReviewStep.ts`, `BMADQAStep.ts` AND their `__tests__/*.test.ts` counterparts.
   - Remove the corresponding exports from `packages/sprint-core/src/index.ts`.
   - Remove the now-dead imports of `BMADDevStoryStep` / `BMADReviewStep` / `BMADQAStep` from `PipelineStepFactory.ts`.
   - If any unrelated file (search the whole repo) still imports any of these three classes, update it to consume `BMADSessionStep` or fail loudly with a TypeScript error rather than leaving a stub.
   - **Exception**: `BMADCommandStep.ts` and `BMADCommandPort.ts` REMAIN — they back the still-living `BudgetChecker` interface and the lower-level command-port abstraction. Do NOT delete them. Only the three legacy WorkflowStep wrappers go.
   - Per Dev Notes "duplication evaporates" promise from EA9-S4 §"Critical Pattern": this is the moment that promise is honored.

4. **AC4 — Sprint-run CLI updated and lint/typecheck clean**
   - `packages/app/src/cli/commands/sprint-run.ts` no longer imports `ClaudeCliAdapter` for the BMAD path (unless it is still legitimately needed by the legacy/non-BMAD path — verify; if useBMAD is the only supported BMAD entry, drop the import).
   - `pnpm typecheck` passes for `@cop1/app` and `@cop1/sprint-core`. Pre-existing TS6310 / `Cop1Config.budget` carry-overs from EA9-S4 are still acceptable; document if any new errors appear.
   - `pnpm lint` (where present) passes.
   - `pnpm test --filter @cop1/sprint-core` and `pnpm test --filter @cop1/app` both green; the only acceptable regressions are tests that explicitly import the deleted legacy step classes — those tests must be deleted alongside their target classes per AC3.

5. **AC5 — `PipelineStepFactory.test.ts` updated**
   - File: `packages/app/src/composition/__tests__/PipelineStepFactory.test.ts`
   - Replace assertions that the BMAD branch returns `BMADDevStoryStep` / `BMADReviewStep` / `BMADQAStep` with assertions that it returns three `BMADSessionStep` instances whose `name`s are `'bmad-dev'`, `'bmad-review'`, `'bmad-qa'` in order.
   - Add a test that `buildBMADSteps()` throws the expected error when `sessionPort` and/or `supervisorService` are missing.
   - Add a test that the legacy branch (`useBMAD: false`) is unaffected (still returns `[DevAgent, ReviewerAgent, QAAgent, PMAgentWorkflowStep]`).
   - Use lightweight stubs for `BMADSessionPort` and `SupervisorService` (or the in-memory adapters from `@cop1/sprint-core`: `InMemorySessionAdapter` + `InMemorySupervisorAdapter` + a real `SupervisorService` with mock `SessionLogger`). Do NOT call the real Agent SDK.

6. **AC6 — Integration test E2E**
   - File: `packages/app/src/integration-tests/bmad-pipeline-e2e.test.ts` (modify the existing file; do NOT create a parallel one).
   - Replace the existing BMAD-pipeline E2E setup so it uses:
     - `InMemorySessionAdapter` as the `BMADSessionPort`
     - `InMemorySupervisorAdapter` + a real `SupervisorService` with an in-memory `SessionLogger`
     - `PipelineStepFactory` constructed via the new (Option A) signature
     - `SprintRunner` running over a fixture sprint with one fake story
   - The test asserts:
     1. The sprint completes with `storiesProcessed >= 1` and `storiesFailed === 0`.
     2. All three `BMADSessionStep` instances were invoked in order (verified via the `InMemorySessionAdapter` call log OR via `eventBus` events `session.started` × 3).
     3. The supervisor's `setWorkflowContext` was called with each of the three `command` values (dev / review / qa) in order. Use a spy on `SupervisorService.setWorkflowContext`.
     4. No call to the deleted legacy steps occurs (compile-time guarantee since they no longer exist — but assert no `bmad.command.*` events are emitted for the legacy code path either).
   - The test runs in under 10 seconds and uses fake delays (`delayFn = async () => {}`) for retries.

7. **AC7 — Update `_bmad-output/planning-artifacts/architecture.md` and ADR-012 cross-refs**
   - In `architecture.md`, search for any reference to `BMADDevStoryStep` / `BMADReviewStep` / `BMADQAStep` and replace with `BMADSessionStep` (singular, parameterized).
   - Add (or update) a one-paragraph note in the BMAD orchestration section: "Since EA9-S5, the BMAD branch of `PipelineStepFactory` returns three `BMADSessionStep` instances sharing a single `AgentSdkSessionAdapter` + `SupervisorService`, completing the ADR-012 multi-turn migration."
   - No other architecture changes — this is a documentation sync, not a re-design.

8. **AC8 — Sprint-status & traceability**
   - Update `_bmad-output/implementation-artifacts/sprint-status.yaml`: `EA9-S5: backlog → in-progress → review → done` per normal lifecycle (the create-story workflow itself only flips it to `ready-for-dev`; the rest is dev/review responsibility).
   - Add a Completion Note in this file's Dev Agent Record listing every file touched (created/modified/deleted) so future archaeology is trivial.

## Tasks / Subtasks

- [x] Task 1 — Inspect legacy steps to extract exact `command` / `errorPrefix` strings (AC: #1)
- [x] Task 2 — Refactor `PipelineStepFactory` constructor + BMAD branch (AC: #1, #2)
- [x] Task 3 — Wire composition root in `sprint-run.ts` (AC: #2, #4)
- [x] Task 4 — Delete legacy step files + tests (AC: #3)
- [x] Task 5 — Update `PipelineStepFactory.test.ts` (AC: #5)
- [x] Task 6 — Update `bmad-pipeline-e2e.test.ts` (AC: #6)
- [x] Task 7 — Sync `architecture.md` (AC: #7)
- [x] Task 8 — Quality gates + sprint-status update (AC: #4, #8)

## Dev Notes

### Architecture Context

This story closes the loop opened by EA9-S1..S4. EA9-S4 added `BMADSessionStep` as a parallel WorkflowStep but explicitly forbade modifying `PipelineStepFactory` (see EA9-S4 AC8 last bullet). This story performs that exact wiring swap and deletes the now-redundant legacy step classes. Per ADR-012 §6.4 ("Composition Root Changes"), the composition root in `sprint-run.ts` is the SOLE place where the Agent SDK adapter, the supervisor adapter, and the `SupervisorService` are instantiated. `PipelineStepFactory` only receives them.

```
sprint-run.ts (composition root)
  ├── eventBus
  ├── AgentSdkSupervisorAdapter
  ├── SessionLogger(structuredLogger)
  ├── SupervisorService(supervisorAdapter, sessionLogger, [])
  │     └── createQuestionHandler() ──┐
  ├── AgentSdkSessionAdapter({ questionHandler, eventBus })  ←──┘
  └── PipelineStepFactory(eventBus, { sessionPort, supervisorService })
        └── buildBMADSteps()
              ├── new BMADSessionStep(sessionPort, supervisorService, devOpts)
              ├── new BMADSessionStep(sessionPort, supervisorService, reviewOpts)
              └── new BMADSessionStep(sessionPort, supervisorService, qaOpts)
```

The three `BMADSessionStep` instances **share** the same `sessionPort` and `supervisorService`. This is intentional and required: the supervisor's `setWorkflowContext()` mechanism re-targets the in-flight command/story/sessionId per step invocation, and the `SessionLogger` accumulates a single coherent history across the dev → review → qa progression.

### Why delete the legacy steps now (not later)

EA9-S4 Dev Notes promised: *"EA9-S5 will delete `BMADDevStoryStep`/`BMADReviewStep`/`BMADQAStep`, at which point the duplication evaporates."* Honoring this immediately:

1. Prevents accidental future use of the single-shot path that ADR-012 deprecated as broken.
2. Removes the duplicated retry/budget/event code that was inlined into `BMADSessionStep` precisely because the legacy classes were known to be on death row.
3. Keeps `@cop1/sprint-core`'s public surface honest — no parallel "old" and "new" BMAD step exports confusing downstream consumers (cop1-method module, EA8 dogfooding, etc.).

If a regression appears post-merge that motivates a rollback, the git history of EA9-S4 + EA9-S5 is the recovery path — do NOT keep the legacy classes "just in case".

### `BMADCommandStep` / `BMADCommandPort` are NOT deleted

These remain because:
- `BMADCommandStep.ts` still defines the `BudgetChecker` interface that `BMADSessionStep` imports as a `type` (per EA9-S4 AC6 option 2 choice).
- `BMADCommandPort` / `ClaudeCliAdapter` may still be used by non-pipeline code paths (e.g., one-off command invocations from CLI subcommands). Audit before assuming dead — `grep -r 'BMADCommandPort\|ClaudeCliAdapter' packages/`. If truly unused outside `PipelineStepFactory`'s old signature, mention it in Dev Notes but DO NOT delete in this story (out of scope — file a follow-up).

### `SupervisorService` constructor — verify signature before wiring

The story above assumes `new SupervisorService(supervisorAdapter, sessionLogger, [])`. Before writing `sprint-run.ts`, **read** `packages/sprint-core/src/features/bmad-orchestration/application/SupervisorService.ts` and confirm the actual constructor parameters and order. Adjust the wiring code accordingly. The same goes for `AgentSdkSupervisorAdapter` and `AgentSdkSessionAdapter` — read their actual constructors (paths in §References below) and use the real signatures, not the sketches in this story.

### `SessionLogger` requires a `StructuredLogger`

`SessionLogger` (EA9-S3) takes a structured logger dependency. Check whether `sprint-run.ts` already has access to the daemon's structured logger via `LoggerBridge` / `StructuredJsonLogger`. If yes, reuse it. If no, instantiate a minimal `new StructuredJsonLogger()` (or whatever the existing convention is in `packages/app`) — do NOT invent a new logger class.

### Project Structure (target state)

```
packages/sprint-core/src/features/bmad-orchestration/
├── application/
│   ├── BMADCommandStep.ts                 ← KEEP (BudgetChecker host)
│   ├── BMADSessionStep.ts                 ← KEEP (the only WorkflowStep for BMAD)
│   ├── SessionLogger.ts                   ← KEEP
│   ├── SessionHistoryReader.ts            ← KEEP
│   ├── SupervisorService.ts               ← KEEP
│   ├── BMADDevStoryStep.ts                ← DELETE
│   ├── BMADReviewStep.ts                  ← DELETE
│   └── BMADQAStep.ts                      ← DELETE
├── domain/
│   └── (unchanged)
├── infrastructure/
│   └── (unchanged — adapters stay)
└── __tests__/
    ├── BMADSessionStep.test.ts            ← KEEP
    ├── BMADDevStoryStep.test.ts           ← DELETE
    ├── BMADReviewStep.test.ts             ← DELETE
    └── BMADQAStep.test.ts                 ← DELETE

packages/app/src/
├── cli/commands/sprint-run.ts             ← MODIFIED (composition root rewiring)
├── composition/PipelineStepFactory.ts     ← MODIFIED (constructor + buildBMADSteps)
├── composition/__tests__/PipelineStepFactory.test.ts  ← MODIFIED (assertions)
└── integration-tests/bmad-pipeline-e2e.test.ts        ← MODIFIED (in-memory adapters + spies)
```

### Project Structure Alignment

- **Hexagonal**: composition root stays in `packages/app` (CLI), domain/application stays in `@cop1/sprint-core`. Adapters live in `infrastructure/` of sprint-core. No new layers.
- **Naming**: step `name` strings reuse `'bmad-dev' / 'bmad-review' / 'bmad-qa'` so existing event consumers (`SprintFormatter`, dashboard) keep working without changes.
- **No new dependencies**: everything used in this story already exists in the package after EA9-S1..S4.
- **No new event types**: `bmad.retry.attempt`, `bmad.retry.transient`, `session.started`, `session.turn.completed`, `session.workflow.completed`, `session.workflow.failed` remain the only emissions.

### Testing Standards

- Vitest, monorepo convention `*.test.ts`.
- E2E test stays under `packages/app/src/integration-tests/` per repo convention; do NOT move it.
- Always inject `delayFn = async () => {}` via the test wiring of `BMADSessionStep` to keep retry tests fast.
- Use `vi.spyOn(supervisorService, 'setWorkflowContext')` for AC6 ordering assertions.
- Do NOT call the real Agent SDK from any test — this is a hard requirement (see EA9-S4 AC8 / Testing Standards).

### References

- [Source: _bmad-output/planning-artifacts/adr-012-multi-turn-bmad-interaction.md — §6.4 Composition Root Changes, §11 Hexagonal Respect, §12 Migration Plan]
- [Source: _bmad-output/planning-artifacts/epics.md — Epic EA9, story EA9-S5 line]
- [Source: _bmad-output/implementation-artifacts/EA9-S4.md — predecessor; especially Dev Notes "Critical Pattern" and AC8 "Do NOT modify PipelineStepFactory"]
- [Source: _bmad-output/implementation-artifacts/EA9-S3.md — `SupervisorService.createQuestionHandler()` and `setWorkflowContext()` semantics]
- [Source: _bmad-output/implementation-artifacts/EA9-S1.md — `AgentSdkSessionAdapter` constructor + `questionHandler` injection point]
- [Source: packages/app/src/composition/PipelineStepFactory.ts — current legacy wiring (target of refactor)]
- [Source: packages/app/src/cli/commands/sprint-run.ts — composition root]
- [Source: packages/app/src/composition/__tests__/PipelineStepFactory.test.ts — tests to update]
- [Source: packages/app/src/integration-tests/bmad-pipeline-e2e.test.ts — E2E test to update]
- [Source: packages/sprint-core/src/features/bmad-orchestration/application/BMADSessionStep.ts — the step being wired in]
- [Source: packages/sprint-core/src/features/bmad-orchestration/application/SupervisorService.ts — verify constructor signature before wiring]
- [Source: packages/sprint-core/src/features/bmad-orchestration/infrastructure/AgentSdkSessionAdapter.ts — verify constructor signature before wiring]
- [Source: packages/sprint-core/src/features/bmad-orchestration/infrastructure/AgentSdkSupervisorAdapter.ts — verify constructor signature before wiring]
- [Source: packages/sprint-core/src/features/bmad-orchestration/application/SessionLogger.ts — required `StructuredLogger` dependency]
- [Source: packages/sprint-core/src/index.ts — barrel exports to prune (legacy step exports) and keep (`BMADSessionStep`, `SupervisorService`, adapters)]
- [Source: _bmad-output/project-context.md — repo conventions]

### Open Questions for Dev (resolve during implementation)

1. What are the **exact** `command` strings used by the legacy `BMADDevStoryStep` / `BMADReviewStep` / `BMADQAStep`? (Read the files; do not guess.) These must be reused verbatim so BMAD slash commands keep resolving.
2. Does `sprint-run.ts` already have a structured logger to feed into `SessionLogger`, or must one be instantiated? (Audit before adding code.)
3. Is `ClaudeCliAdapter` still consumed by any non-pipeline code path? If yes, keep the import. If no, drop it.
4. Does `AgentSdkSupervisorAdapter` need any non-default constructor args (e.g., model selection, system prompt override)? Use existing defaults from `AgentSdkSupervisorAdapter.test.ts` if nothing else is documented.

## Dev Agent Record

### Agent Model Used

claude-opus-4-6 (1M context)

### Debug Log References

### Completion Notes List

- Chose **Option A** in AC2: `PipelineStepFactory` constructor now accepts an options object `{ sessionPort?, supervisorService? }`. The legacy `commandPort` parameter has been removed entirely. `buildBMADSteps()` throws `'BMADSessionPort and SupervisorService are required when workflow.useBMAD is true'` if either is missing.
- Three `BMADSessionStep` instances are constructed with verbatim legacy `command` / `errorPrefix` strings extracted from the deleted classes:
  - dev: `/bmad-bmm-dev-story` / `BMAD dev-story failed`
  - review: `/bmad-bmm-code-review` / `BMAD code-review failed`
  - qa: `/bmad-bmm-qa-automate` / `BMAD QA validation failed`
- `sprint-run.ts` composition root now constructs (in order): `EventBus`, `StructuredLogger`, `SessionLogger`, lazy `supervisorQueryFn` (dynamic-imports `@anthropic-ai/claude-agent-sdk` at runtime to avoid forcing `@cop1/app` to declare a direct SDK dep, with a `@ts-expect-error` on the import line), `AgentSdkSupervisorAdapter`, `SupervisorService`, `questionHandler`, `AgentSdkSessionAdapter`, then injects `{ sessionPort, supervisorService }` into `PipelineStepFactory`. `ClaudeCliAdapter` import was dropped — it is no longer used by `sprint-run.ts`.
- Legacy step files deleted: `BMADDevStoryStep.ts`, `BMADReviewStep.ts`, `BMADQAStep.ts` (+ their `__tests__/*.test.ts`). Barrel exports pruned from `packages/sprint-core/src/index.ts`. `grep` of `packages/` for the deleted class names returns zero matches.
- `BMADCommandStep.ts` and `BMADCommandPort.ts` are intentionally retained per AC3 (BudgetChecker host + lower-level command-port abstraction). `ClaudeCliAdapter` is also retained in `@cop1/sprint-core` (still tested by `ClaudeCliAdapter.test.ts`); only `sprint-run.ts` no longer imports it.
- `PipelineStepFactory.test.ts` rewritten end-to-end against the new constructor: 5 tests covering BMAD branch (3 BMADSessionStep instances, names in order), legacy branch (4 steps), missing-collaborator error, partial-collaborator error, and missing-configLoader error.
- `bmad-pipeline-e2e.test.ts` rewritten to use `InMemorySessionAdapter` + `InMemorySupervisorAdapter` + real `SupervisorService` with stub structured logger. The full SprintRunner pipeline runs end-to-end on a tempdir fixture project; assertions cover (a) `storiesProcessed >= 1`, `storiesFailed === 0`, (b) `vi.spyOn(supervisorService, 'setWorkflowContext')` records all three commands in dev → review → qa order, (c) no legacy `bmad.command.*` events leak. The legacy `ClaudeCliAdapter`/`fake-claude` integration suites that wrapped the deleted step classes were removed alongside their targets per AC3.
- `architecture.md` updated: deleted-class lines collapsed into a single `BMADSessionStep.ts` line that references EA9-S5 + ADR-012; the migration table row now marks the legacy classes as **Supprimés en EA9-S5**.
- Quality gates: `pnpm test` → 697 passed / 1 skipped (no failures, no regressions). `pnpm --filter @cop1/app typecheck` produces only the pre-existing carry-over errors (`Cop1Config.budget` shape, unrelated `BmadBridgeService` issues) — no NEW errors introduced by this story. `@cop1/sprint-core` typecheck has the same pre-existing carry-overs documented in EA9-S4 (`Cop1Config.budget`, `SessionHandle` import in `BMADSessionStep.ts:200`, etc.); none originate from EA9-S5 changes.

### File List

**Modified:**
- `packages/app/src/composition/PipelineStepFactory.ts`
- `packages/app/src/cli/commands/sprint-run.ts`
- `packages/app/src/composition/__tests__/PipelineStepFactory.test.ts`
- `packages/app/src/integration-tests/bmad-pipeline-e2e.test.ts`
- `packages/sprint-core/src/index.ts`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (EA9-S5: ready-for-dev → in-progress → review → done)
- `_bmad-output/implementation-artifacts/EA9-S5.md` (this file)
- `packages/sprint-core/src/features/bmad-orchestration/infrastructure/AgentSdkSupervisorAdapter.ts` (review-fix: optional `queryFn` + static `loadSdkQuery()` mirroring `AgentSdkSessionAdapter`)

### Code Review Fixes (2026-04-06)

- **MEDIUM #1** — `PipelineStepFactory.test.ts:createConfig()` now sets `budget: { sprint_max_tokens: 0, alert_thresholds: [], auto_pause: false }` so the file no longer introduces a fresh `Cop1Config.budget` `TS2741` error.
- **MEDIUM #2** — `bmad-pipeline-e2e.test.ts` inline config now also includes `budget`, removing the `as unknown as Cop1Config` double-cast (and the now-unused `Cop1Config` import).
- **MEDIUM #3** — `AgentSdkSupervisorAdapter` constructor parameter `queryFn` is now optional and defaults to a new static `loadSdkQuery()` that lazy-imports `@anthropic-ai/claude-agent-sdk` and adapts it to `SupervisorQueryFunction` (mirrors `AgentSdkSessionAdapter.loadSdkQuery()`). `sprint-run.ts` no longer hand-rolls a `supervisorQueryFn` with a `@ts-expect-error` dynamic import — it just calls `new AgentSdkSupervisorAdapter()`. ~40 lines deleted from the composition root.
- **LOW #5** — Removed the dead `FIXTURES_DIR` constant + `void FIXTURES_DIR;` suppression from `bmad-pipeline-e2e.test.ts`.
- Verification: `pnpm --filter @cop1/app exec tsc --noEmit` produces zero errors on the four EA9-S5 files; `pnpm vitest run` on `PipelineStepFactory.test.ts`, `bmad-pipeline-e2e.test.ts`, and `AgentSdkSupervisorAdapter.test.ts` → 23/23 green.

**Deleted:**
- `packages/sprint-core/src/features/bmad-orchestration/application/BMADDevStoryStep.ts`
- `packages/sprint-core/src/features/bmad-orchestration/application/BMADReviewStep.ts`
- `packages/sprint-core/src/features/bmad-orchestration/application/BMADQAStep.ts`
- `packages/sprint-core/src/features/bmad-orchestration/__tests__/BMADDevStoryStep.test.ts`
- `packages/sprint-core/src/features/bmad-orchestration/__tests__/BMADReviewStep.test.ts`
- `packages/sprint-core/src/features/bmad-orchestration/__tests__/BMADQAStep.test.ts`
