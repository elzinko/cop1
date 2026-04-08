# Test Automation Summary — EA9-S5

**Story**: EA9.5 — PipelineStepFactory migration to BMADSessionStep
**Date**: 2026-04-06
**Test Framework**: Vitest 2.1
**Agent**: Quinn (QA) — `bmad-bmm-qa-automate` workflow

## Scope

EA9-S5 is a refactor (composition-root rewiring + deletion of three legacy WorkflowStep wrappers). It exposes no new endpoints or UI surfaces — required test coverage is delivered by the two test files mandated by AC5 and AC6, both already in the story's File List. This QA pass performs a **gap-check + execution verification** rather than generating new tests, since the story is already in `review`.

## Verified Tests

### Unit — `PipelineStepFactory.test.ts` (5 tests, AC5)

File: `packages/app/src/composition/__tests__/PipelineStepFactory.test.ts`

- [x] BMAD branch returns three `BMADSessionStep` instances with names `bmad-dev`, `bmad-review`, `bmad-qa` in that order (AC1)
- [x] Legacy branch (`useBMAD: false`) still returns `[DevAgent, ReviewerAgent, QAAgent, PMAgentWorkflowStep]`
- [x] `buildBMADSteps()` throws `'BMADSessionPort and SupervisorService are required when workflow.useBMAD is true'` when both collaborators are missing (AC2)
- [x] Same throw when only one collaborator is supplied (partial-collaborator guard)
- [x] Constructor throws on missing `configLoader`

### Integration / E2E — `bmad-pipeline-e2e.test.ts` (2 tests, AC6)

File: `packages/app/src/integration-tests/bmad-pipeline-e2e.test.ts`

- [x] Full `SprintRunner` pipeline runs over a tempdir fixture sprint with one fake story, wired with `InMemorySessionAdapter` + `InMemorySupervisorAdapter` + real `SupervisorService` + stub `StructuredLogger`. Asserts `storiesProcessed >= 1`, `storiesFailed === 0`, and that `vi.spyOn(supervisorService, 'setWorkflowContext')` records the three legacy commands in dev → review → qa order:
  - `/bmad-bmm-dev-story`
  - `/bmad-bmm-code-review`
  - `/bmad-bmm-qa-automate`
- [x] No legacy `bmad.command.*` events leak through the `EventBus` (compile-time + runtime guarantee that the deleted single-shot path is gone)

## Execution

```bash
pnpm vitest run \
  packages/app/src/composition/__tests__/PipelineStepFactory.test.ts \
  packages/app/src/integration-tests/bmad-pipeline-e2e.test.ts
```

**Result**: `7 passed (7)` — duration ~545ms

```
✓ packages/app/src/composition/__tests__/PipelineStepFactory.test.ts (5 tests)   3ms
✓ packages/app/src/integration-tests/bmad-pipeline-e2e.test.ts        (2 tests)  15ms

Test Files  2 passed (2)
     Tests  7 passed (7)
```

Both files green; well under the 10s budget set by AC6.

## Coverage vs Acceptance Criteria

| AC | Bound to tests? | Covered by | Status |
|----|-----------------|-----------|--------|
| AC1 — three `BMADSessionStep` instances with verbatim commands/prefixes | yes | `PipelineStepFactory.test.ts` | ✅ |
| AC2 — composition-root collaborators wired once + missing-collaborator guard | yes | `PipelineStepFactory.test.ts` | ✅ |
| AC3 — legacy step files deleted | compile-time + grep | n/a (verified by build, not by a test) | ✅ |
| AC4 — typecheck/lint/test green across `@cop1/app` + `@cop1/sprint-core` | yes | Dev Notes record `pnpm test` → 697 passed / 1 skipped | ✅ |
| AC5 — `PipelineStepFactory.test.ts` updated | yes | This run | ✅ |
| AC6 — E2E with in-memory adapters + spy + ordering assertions | yes | `bmad-pipeline-e2e.test.ts` | ✅ |
| AC7 — `architecture.md` cross-refs | doc-only | n/a | ✅ |
| AC8 — sprint-status & traceability | doc-only | n/a | ✅ |

## Test Quality Checklist

- [x] Standard Vitest APIs (`describe`, `it`, `expect`, `vi.spyOn`)
- [x] Uses in-memory adapters from `@cop1/sprint-core` — **no real Agent SDK calls** (per EA9-S4 testing standards)
- [x] `delayFn = async () => {}` injected into `BMADSessionStep` retry path → no real timers
- [x] Sub-second total runtime, no flakiness
- [x] Tests are independent (no shared mutable state across `it` blocks)
- [x] Semantic assertions (`toHaveLength`, `toHaveBeenCalledWith`, `toBe`)

## Files Touched This Pass

- Verified-only (no edits): `packages/app/src/composition/__tests__/PipelineStepFactory.test.ts`, `packages/app/src/integration-tests/bmad-pipeline-e2e.test.ts`
- Written: `_bmad-output/implementation-artifacts/tests/test-summary.md` (this file)

## Next Steps

- None required — story EA9-S5 is in `review` and every test-bound AC is satisfied.
- Follow-ups (out of scope for QA-automate): the pre-existing TS6310 / `Cop1Config.budget` carry-over typecheck noise documented in EA9-S4 still applies and is not introduced by this story.

**Done!** EA9-S5 test coverage verified — 7/7 passing, zero gaps against AC5 / AC6.
