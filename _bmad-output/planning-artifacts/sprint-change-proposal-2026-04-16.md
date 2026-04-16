---
date: 2026-04-16
author: elzinko (with Claude as SM)
trigger: empirical-shakedown-real-run-report-2026-04-16
mode: batch
scope_classification: Moderate (new epic + 4 backlog stories, no ADR change)
supersedes: none
related_scps:
  - sprint-change-proposal-2026-04-15-adversarial-review.md
related_artefacts:
  - _bmad-output/implementation-artifacts/real-run-report-2026-04-16.md
  - _bmad-output/implementation-artifacts/epic-ea12-retro-2026-04-15.md
decisions:
  - E1: pnpm_build_unblock
  - E2: bmad_command_runner_real_wiring
  - E3: real_run_validation_gate
  - E4: story_session_commit_wiring
---

# Sprint Change Proposal — EA13 Orchestrator Wiring & Build Fix (2026-04-16)

## 1. Issue Summary

The 2026-04-16 **empirical shakedown** (`real-run-report-2026-04-16.md`) executed `cop1 orchestrator run --epic EX1` against a sandboxed sample epic. The run exits 0 and writes a JSONL log, but **0% of the promised behaviour happens**: no BMAD command runs, no code is produced, no commit is created, no session is logged. Every observed gap is a **wiring gap**, not a missing feature — EA9/EA10/EA11/EA12 built the organs, but the CLI never routes blood through them.

On top of that, `pnpm build` fails from scratch (~20 TS errors across `sprint-core` and `app`), so a new developer cloning the repo today cannot build cop1. EA12-S1 dev notes already documented these errors as "out of scope / pre-existing" — EA13 is the dedicated sprint to burn them down.

This SCP formalises **EA13 — Orchestrator Wiring & Build Fix** as the next sprint, replacing the earlier adversarial-review-driven scoping (per EA12 retro decision: "no two review-driven sprints in a row — let empirical data define EA13").

## 2. Impact Analysis

### 2.1 Artifact Impact

| Artifact | Impact |
|---|---|
| `_bmad-output/planning-artifacts/epics.md` | New section `## Epic EA13 — Orchestrator Wiring & Build Fix` with 4 stories. Récapitulatif Backlog table updated. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Add `epic-ea13` + `EA13-S1..S4` + `epic-ea13-retrospective: optional`. |
| `packages/app/src/cli/commands/orchestrator.ts` | Default `stubRunner` replaced by a real `BMADCommandRunner` that delegates to `BMADSessionPort` / `SupervisorService`. Stub factory kept exported for tests only. |
| `packages/sprint-core/src/index.ts` | Duplicate `SupervisorContext` export cleaned. `ApprovalResolver` missing export restored (or import site corrected). |
| Strict-null test fixtures | 20 TS errors (enumerated in real-run report Gap #1) resolved. |
| Story body update hook | Orchestrator writes `## Status: <value>` back into `<STORY>.md` on each phase transition (EA12 retro #4 carry-over). |

### 2.2 Epic Impact

- **Added:** `epic-ea13` (Sprint 14) with 4 stories.
- **Not added (deferred to EA14):** security mini-pass (AT-1..AT-6 from EA12 retro Review #2), narrative catchup (EA12 retro action #5). These wait for EA13 empirical signal before scoping.
- **No resequencing** of existing backlog epics.

### 2.3 Technical Impact

- S1 (build fix) is **mechanical**: strict-null guards + 1 export restoration. No runtime behaviour change.
- S2 (real runner) is the **load-bearing change**: turns `cop1 orchestrator run` from state-machine simulator into real sprint engine. Depends on S1 (green build is prerequisite for iterative work).
- S3 (validation re-run) is a **gate**, not a feature — asserts S1+S2 produce Track 1/2/3 + a real commit + an updated story body on the EX1 cobaye.
- S4 (story body update) closes the Story↔Session↔Commit triangle. Small scope, high discoverability value.

## 3. Recommended Approach

**Path chosen: Direct Adjustment — add epic, wire runner, gate via re-run.**

Every gap is plumbing. The infrastructure exists (EA9/EA10/EA11/EA12). The fix is a handful of specific wiring points, not a redesign.

**Effort:** S1 ~0.5d, S2 ~1.5d, S3 ~0.5d, S4 ~0.5d. Total ~3 dev-days for Sprint 14.
**Risk:** LOW for S1/S3/S4; MEDIUM for S2 because crossing the stub boundary may surface latent lifecycle bugs in `BMADSessionPort` or `SprintRunner`. Mitigation: keep the stub runner accessible behind an explicit `--runner stub` override (dev/test path) so tests do not become hostages of S2.

## 4. Detailed Decisions

### E1 — Unblock `pnpm build` from clean clone

Fix the 20 TS errors listed in `real-run-report-2026-04-16.md` Gap #1. Primary offenders:

- `ApprovalResolver` not exported from `@cop1/sprint-core` (import in `InterCommandApprovalResolver.ts:3`).
- Strict-null guards missing in: `ExchangeHistoryReader.test.ts`, `MetricsWriter.test.ts`, `SessionTranscriptGenerator.ts`, `OrchestratorService.ts`, `SupervisorPlaybookLoader.ts`, `orchestrator.test.ts`, `OrchestratorService.test.ts`, `orchestrator-e2e.test.ts`.
- Possible duplicate `SupervisorContext` export in `sprint-core/src/index.ts` (flagged in EA12-S1 dev notes).

**DoD:** `pnpm build` exits 0 from a cold clone. `pnpm test` still green.

### E2 — Real `BMADCommandRunner` wired by default

`packages/app/src/cli/commands/orchestrator.ts:25-32` currently defines a `stubRunner` returning canned transitions. `orchestrator.ts:77` falls back to it when `overrides.runner` is absent, and `index.ts:75-77` never passes a runner through. Result: CLI always uses the stub.

**New wiring (S2 DoD):**
- Default runner invokes `BMADSessionPort.invokeCommand(...)` via a thin adapter that drives `SupervisorService` for each `(story × phase)` tuple.
- Stub runner is exported from a `testing/` subpath and is the explicit non-default for tests.
- `index.ts` constructs the default runner from configuration and passes it in `overrides` (or the CLI entry point builds it inline — implementation choice).
- Contract: runner returns `{ status, decisionMethod }` — same shape as stub — so the orchestrator state machine is untouched.
- `--runner stub` CLI flag (hidden, dev-only) kept for smoke testing without MCP/SDK cost.

### E3 — Validation re-run as exit gate for the epic

Replay the exact procedure from `real-run-report-2026-04-16.md` against the EX1 cobaye (`/tmp/cop1-ea13-validation/`) after S1 + S2 land. Expected observable outputs:

- `.cop1/history/EX1-S1/track1/`, `track2/`, `track3/` directories populated.
- At least one real git commit in the worktree with a `Co-Authored-By` trailer.
- `EX1-S1.md` body reflects final status (requires S4, so either run after S4 or accept a residual red for this line).
- `sprint-status.yaml` flipped to `EX1-S1: done`.
- JSONL log contains real (non-stub) decision events.

**DoD:** a reproduction script + an integration test under `packages/app/src/integration-tests/` asserts the observables above. Script lives alongside the existing `orchestrator-e2e.test.ts`.

### E4 — Story body auto-update on status transition

Close EA12 retro action item #4: the orchestrator mutates only `sprint-status.yaml`, not the story body. After each phase transition, rewrite `## Status: <value>` in `<STORY>.md` (idempotent — regex replace). Keep YAML as source of truth; story body is a mirror.

**DoD:** After a run, `grep "^## Status:" <STORY>.md` reflects the current YAML status. Unit test on a temp story file.

## 5. Implementation Handoff

### 5.1 Scope Classification

**Moderate.** New epic, 4 stories, one new default runtime wiring, one build-fix pass. No ADR changes. No schema break.

### 5.2 Stories Summary

| # | Story | Size | Depends on |
|---|---|---|---|
| 1 | EA13-S1 — Fix `pnpm build` (TS errors, exports) | S | — |
| 2 | EA13-S2 — Real `BMADCommandRunner` default | M | S1 |
| 3 | EA13-S3 — Validation re-run + integration test | S | S1, S2 |
| 4 | EA13-S4 — Story body auto-update on transition | S | — (can parallelise with S2) |

### 5.3 Success Criteria

1. `pnpm build && pnpm test && pnpm lint` green from cold clone.
2. Running `cop1 orchestrator run --epic EX1 --project-root /tmp/...` on a real fixture produces real BMAD invocations, real `.cop1/history/` files, at least one real git commit, and an updated story body.
3. Stub runner still usable via explicit `--runner stub` or testing subpath — existing tests not regressed.
4. Integration test `orchestrator-real-run.test.ts` encodes the observables from E3.

### 5.4 Out of Scope (deferred to EA14 or later)

- Security mini-pass (AT-1..AT-6 from EA12 retro Review #2).
- Narrative catchup (EA12 retro action #5).
- Layer separation `*Core.ts` extraction (A3 from SCP 2026-04-15).
- EA8 Distribution stories.

## 6. Approval

**Auto-approved by the session-unique execution directive of 2026-04-16** — elzinko instructed "session unique sur EA13, pas d'arrêt ni de question, tu dois tout gérer". This SCP is the formalisation of the real-run report's scope recommendation (items 1 + 2 + 3 + 4). No further approval loop.
