# EA13 — Deferred items

Items discovered during EA13 work that are MEDIUM/LOW priority or out of scope.
Per the execution rule: auto-accept only HIGH/BLOCKER; log everything else here.

## Pre-existing test failures (pre-EA13, not caused by S1)

9 test failures exist on baseline (verified by stashing S1 diff and re-running `pnpm test`):

| File | Test | Observation |
|---|---|---|
| `packages/app/src/integration-tests/bmad-pipeline-e2e.test.ts` | `SprintRunner + BMAD session pipeline (in-memory adapters) > runs dev → review → qa via three BMADSessionStep instances` | Pipeline wiring regression |
| `packages/app/src/composition/__tests__/SprintRunner.test.ts` | `should run all eligible stories through the workflow` | `storiesDone` returned 0 instead of 3 |
| `packages/app/src/composition/__tests__/SprintRunner.test.ts` | `should not process stories already done in reader` | Same class of failure |
| `packages/app/src/composition/__tests__/SprintRunner.test.ts` | `should filter stories by pattern` | Same |
| `packages/app/src/composition/__tests__/SprintRunner.test.ts` | `should emit sprint and story.completed events` | Events not emitted — stories never ran |
| `packages/app/src/composition/__tests__/SprintRunner.test.ts` | `should emit story.completed for each done story` | Same |
| `packages/app/src/composition/__tests__/SprintRunner.test.ts` | `simulate mode > should create a worktree and execute sprint inside it` | Worktree path OK but `storiesDone` = 0 |
| `packages/app/src/composition/__tests__/SprintRunner.test.ts` | `simulate mode > should not modify main project in simulate mode` | Same |
| `packages/app/src/composition/__tests__/SprintRunner.test.ts` | `simulate mode > should support simulate with filter` | Same |

**Hypothesis:** these failures stem from the post-EA12 deprecation of `useBMAD=false` legacy path (EA11-S2) — SprintRunner likely lost a default wiring. EA13-S2 (real `BMADCommandRunner`) will either fix these by restoring end-to-end execution, or confirm that the SprintRunner test harness needs refresh. **Decision: defer to EA13-S2 and revisit at EA13-S3 validation.**

Priority: **MEDIUM** — already red on baseline, does not regress with S1; S2 wiring is the natural place to re-check.

## Pre-existing lint errors (13 errors on baseline)

`pnpm lint` exits 1 on the baseline commit (`c9a2d99`). After EA13-S1, the same 13 errors remain (S1 does not regress). 12 new warnings were introduced (style `noNonNullAssertion` on test `!`). My production `!` in `SessionTranscriptGenerator.ts` was refactored to explicit narrowing per AC5.

The 13 pre-existing errors are scattered across BMADSessionStep.test.ts, ClaudeResumeSessionAdapter.test.ts, and other files untouched by EA13-S1. Biome's `noNonNullAssertion` is warning-level for most sites, but a handful of other style/correctness rules fire as errors.

**Decision: defer full lint cleanup to a dedicated V1.1 lint-hygiene story (EA14 or later).** EA13 scope is wiring correctness, not lint zero-baseline.

Priority: **MEDIUM** — matches the "not zero errors but no regression" posture that EA12-S1 used for TS errors (before EA13-S1 closed them).

## Scope creep opportunities rejected

- **Replace all 12 test `!` with narrowing** — would turn a mechanical 9-file story into a 20-site refactor. Rejected: warnings (not errors), idiomatic in test fixtures.
- **Unify `vi.fn<T>()` typing pattern across OrchestratorService.test.ts** — out of scope. The side-effect array pattern used in the fallback test is readable and local.
- **Rewrite the regex in `SupervisorPlaybookLoader.ts`** to make `commandMatch[1]` non-optional by shape — would touch playbook parsing semantics. Rejected: not a build-fix concern.

---

*Generated 2026-04-16 during EA13-S1 execution. Updated per-story as EA13 progresses.*
