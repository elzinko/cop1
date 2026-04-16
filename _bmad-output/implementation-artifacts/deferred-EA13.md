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

## Code/adversarial review findings — EA13-S1 (not auto-applied)

From quality-control-enforcer code review + adversarial review of commit `d01746f`. All MEDIUM / LOW — no HIGH/BLOCKER. Parked here per execution rule.

| # | Severity | File:line | Finding | Disposition |
|---|---|---|---|---|
| 1 | MEDIUM | `OrchestratorService.ts:238` | `if (!key) continue;` is unreachable; masks future regex loosening. Prefer throw-on-unreachable for consistency with `SessionTranscriptGenerator`. | Park — refactor in EA14 lint-hygiene or EA13-retro. |
| 2 | MEDIUM | `OrchestratorService.test.ts:193-220` | Side-effect array pattern loses direct access to `runner.mock.calls` shape. | Accept — functional equivalence, pragmatic syntax dodge for `vi.fn<>` tuple typing. |
| 3 | MEDIUM | — | Zero new tests added for 3 production narrowings. | Park — coverage for parse/extract edge cases belongs with a test-quality story, not a build fix. |
| 4 | MEDIUM | `deferred-EA13.md` | Hypothesis "S2 fixes the 9 SprintRunner failures" is can-kicking. | Mitigation: **EA13-S3 validation will re-check**; if still red, escalate at S3 adversarial review. |
| 5 | MEDIUM | `@cop1/sprint-core` tests | No lock test for `ApprovalResolver` barrel export. | Park — add a type-export smoke test in an EA14 API-surface hygiene story. |
| 6 | LOW | `SessionTranscriptGenerator.ts:40-45` | Throw-on-unreachable overkill vs. `!` + inline invariant comment. | Keep — consistent with AC5. |
| 7 | LOW | `SupervisorPlaybookLoader.ts:88` | `commandMatch[0] ?? ''` is dead-branch compliance. | Keep — matches the loader's defensive style. |
| 8 | LOW | commit `d01746f` | 15 files / 3 concerns bundled. | Accept — session-unique execution constraint. |
| 9 | LOW | `real-run-report-2026-04-16.md` | Committed inside S1 instead of a prior docs commit. | Accept — report drove S1 scope; orphaned otherwise. |
| 10 | LOW | lint | 12 new `noNonNullAssertion` warnings. | Park — EA14 lint-hygiene story. |
| 11 | LOW | `orchestrator.test.ts:29` | `null` broadening papers over a Node API investigation. | Accept — backup/restore pattern is lossy without `null`. |

## Scope creep opportunities rejected

- **Replace all 12 test `!` with narrowing** — would turn a mechanical 9-file story into a 20-site refactor. Rejected: warnings (not errors), idiomatic in test fixtures.
- **Unify `vi.fn<T>()` typing pattern across OrchestratorService.test.ts** — out of scope. The side-effect array pattern used in the fallback test is readable and local.
- **Rewrite the regex in `SupervisorPlaybookLoader.ts`** to make `commandMatch[1]` non-optional by shape — would touch playbook parsing semantics. Rejected: not a build-fix concern.

---

*Generated 2026-04-16 during EA13-S1 execution. Updated per-story as EA13 progresses.*
