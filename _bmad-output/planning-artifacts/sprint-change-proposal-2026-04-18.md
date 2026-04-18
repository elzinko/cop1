---
date: 2026-04-18
author: elzinko (with Claude as SM)
trigger: ea13-retro-action-items-plus-real-run-gap-analysis
mode: batch
scope_classification: Moderate (new epic + 6 backlog stories, no ADR change)
supersedes: none
related_scps:
  - sprint-change-proposal-2026-04-16.md
related_artefacts:
  - _bmad-output/implementation-artifacts/real-run-report-2026-04-16.md
  - _bmad-output/implementation-artifacts/epic-ea13-retro-2026-04-16.md
  - _bmad-output/implementation-artifacts/deferred-EA13.md
decisions:
  - E1: bmad_bundle_detection
  - E2: exchange_history_writer_wiring
  - E3: commit_anchor_supervisor_prompt
  - E4: supervisor_context_name_clash
  - E5: sprint_runner_test_failures
  - E6: baseline_lint_cleanup
---

# Sprint Change Proposal — EA14 Real-Run Closure & Hygiene (2026-04-18)

## 1. Issue Summary

EA13 (Sprint 14) was completed on 2026-04-16, delivering build-fix, real `BMADCommandRunner` wiring, integration test, and story body auto-update. The `scripts/ea13-real-run.sh` empirical gate was then executed against a sandboxed project root. Results:

- CLI exits 0, state transitions work, JSONL log is populated.
- **No `.cop1/history/` directory created** — the 3-track history (EA11-S8) never fires because `ExchangeHistoryWriter` is not wired into the orchestrator's session adapter flow.
- **No real git commits with `Co-Authored-By` trailer** — the `commit_anchor` tool (EA12-S1) exists in the supervisor tool catalog but the supervisor system prompt does not instruct the LLM to invoke it after dev-story.
- **BMAD commands completed in ~4 seconds total** — the sandbox lacked a `_bmad/` installation, so the orchestrator ran against a fiction. No pre-flight check prevents this.

Additionally, the EA13 retrospective (section 6 "Action items") identified hygiene carry-overs:

- `SupervisorContext` name clash between two types with different shapes.
- 9 pre-existing `SprintRunner.test.ts` / `bmad-pipeline-e2e.test.ts` test failures.
- 13 pre-existing lint errors on baseline.

This SCP formalises **EA14 — Real-Run Closure & Hygiene** as Sprint 15, addressing the three blocking wiring gaps that prevent a genuine end-to-end run plus the three hygiene items that erode baseline quality.

## 2. Impact Analysis

### 2.1 Artifact Impact

| Artifact | Impact |
|---|---|
| `_bmad-output/planning-artifacts/epics.md` | New section `### Epic EA14 — Real-Run Closure & Hygiene` with 6 stories. Backlog table updated. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Add `epic-ea14` + `EA14-S1..S6` + `epic-ea14-retrospective: optional`. |
| `packages/app/src/cli/commands/orchestrator.ts` (or `OrchestratorService`) | Pre-flight check: refuse to start if `_bmad/` is absent in `projectRoot`. |
| `packages/sprint-core/src/features/bmad-orchestration/` | Wire `ExchangeHistoryWriter` into the session adapter lifecycle so Track 1/2/3 files are emitted. |
| Supervisor system prompt / tool catalog | Ensure `commit_anchor` invocation guidance is present in the prompt the LLM receives. |
| `packages/sprint-core/src/domain/SupervisorContext.ts` | Rename one of the two `SupervisorContext` types to eliminate the name clash. |
| `packages/sprint-core/src/features/bmad-orchestration/SprintRunner.test.ts` | Fix or document the 9 pre-existing failures. |
| Various source files | Clean 13 lint errors on baseline. |

### 2.2 Epic Impact

- **Added:** `epic-ea14` (Sprint 15) with 6 stories.
- **Not added (deferred to EA15+):** security mini-pass (AT-1..AT-6), narrative catchup, layer separation `*Core.ts`, session lifecycle extraction, BMAD BMM skill registration. These await EA14 empirical signal.
- **No resequencing** of existing backlog epics.

### 2.3 Technical Impact

- **S1 (BMAD bundle detection):** Small guard — the orchestrator checks for `_bmad/` in `projectRoot` and fails fast with a clear error. Prevents silent fiction runs. No runtime behaviour change when BMAD is present.
- **S2 (ExchangeHistoryWriter wiring):** Load-bearing change — connects the 3-track history writer (EA11-S8) into the session adapter lifecycle so that Track 1 (raw SDK exchanges), Track 2 (markdown), and Track 3 (structured events) are emitted during real runs. Without this, the entire history subsystem is dead code.
- **S3 (commit_anchor supervisor prompt):** Verify and fix the supervisor system prompt to include explicit guidance for invoking `commit_anchor` after dev-story completion. May also require verifying the tool is registered in the MCP tool catalog the supervisor receives.
- **S4-S6 (hygiene):** Mechanical cleanup. No new runtime behaviour. Can be deferred within the epic if time runs short.

## 3. Recommended Approach

**Path chosen: Direct Adjustment — add epic, wire missing plumbing, gate via re-run.**

The three blocking items (S1-S3) are all wiring gaps — the infrastructure exists from EA11/EA12 but is not connected in the orchestrator flow. No redesign needed. The three hygiene items (S4-S6) are pre-existing debt that erode CI confidence and developer experience.

**Effort:** S1 ~0.5d, S2 ~1.5d, S3 ~0.5d, S4 ~0.5d, S5 ~1d, S6 ~0.5d. Total ~4.5 dev-days for Sprint 15.
**Risk:** MEDIUM — real BMAD invocation (once S1 ensures `_bmad/` is present) may surface latent adapter lifecycle bugs in `BMADSessionPort` or `ExchangeHistoryWriter`. Mitigation: S1 fail-fast guard prevents silent fiction; S2 is testable in isolation via a unit test that asserts Track 1/2/3 file creation; S3 is verifiable by inspecting the assembled system prompt.

## 4. Detailed Decisions

### E1 — BMAD Bundle Detection (EA14-S1)

The EA13 real-run revealed that the orchestrator happily ran without `_bmad/` present, producing stub-like results with no real BMAD execution. The fix is a pre-flight check in the orchestrator startup path.

**Implementation:**
- Before starting the sprint loop, check that `path.join(projectRoot, '_bmad')` exists and contains expected markers (e.g., `_bmad/bmm/config.yaml` or `_bmad/core/`).
- If absent, exit with a clear error: `"BMAD installation not found at <projectRoot>/_bmad/. Cannot run orchestrator without BMAD."` Exit code 1 (missing playbook precedent).
- Optionally accept a `--bmad-root <path>` override for non-standard layouts.

**DoD:** Running `cop1 orchestrator run --epic EX1 --project-root /tmp/empty/` exits 1 with the error message. Unit test covers the guard.

### E2 — Wire ExchangeHistoryWriter into Session Adapter Flow (EA14-S2)

EA11-S8 built the 3-track history writer (`ExchangeHistoryWriter`) and EA12-S6 extended Track 2 format. But neither is wired into the orchestrator's session adapter flow. `SessionLogger` writes structured JSONL logs; `ExchangeHistoryWriter` writes the `.cop1/history/<story>/track{1,2,3}/` files. They are complementary but only `SessionLogger` is connected.

**Implementation:**
- Locate the session adapter lifecycle (in `DefaultBMADCommandRunner` or `BMADSessionStep`) where SDK exchanges are processed.
- After each exchange round-trip, feed the raw exchange data to `ExchangeHistoryWriter.writeTrack1()`.
- After session completion, invoke `ExchangeHistoryWriter.writeTrack2()` (markdown summary) and `ExchangeHistoryWriter.writeTrack3()` (structured events).
- Verify that `.cop1/history/<storyId>/track1/`, `track2/`, `track3/` directories are created and populated.

**DoD:** After a real run, `ls .cop1/history/EX1-S1/track{1,2,3}/` shows files. Integration test asserts directory structure and non-empty content.

### E3 — Supervisor Prompt Includes commit_anchor Guidance (EA14-S3)

EA12-S1 delivered a real `commit_anchor` tool implementation. The tool is registered in the supervisor's MCP tool catalog. However, the supervisor system prompt does not explicitly instruct the LLM to invoke `commit_anchor` after completing a dev-story phase. Without prompt guidance, the LLM has no reason to call the tool.

**Implementation:**
- Audit the supervisor system prompt assembly (likely in `SupervisorService` or the prompt template).
- Add explicit instruction: after a successful dev-story phase, the supervisor should invoke `commit_anchor` with the story ID and a summary of changes.
- Verify the tool is included in the MCP tool list the supervisor receives at session start.
- If the tool is missing from the catalog, wire it in.

**DoD:** Inspecting the assembled supervisor prompt (via debug log or test) shows commit_anchor guidance. A real run produces at least one git commit with `Co-Authored-By` trailer.

### E4 — Resolve SupervisorContext Name Clash (EA14-S4)

Two types named `SupervisorContext` in `@cop1/sprint-core`:
- `domain/SupervisorContext.ts` (EA11-S6 bootstrap — PRD / architecture / project metadata)
- `domain/ports/SupervisorLLMPort.ts` (per-question context — workflowCommand / storyId / storyContent)

EA13-S2 worked around this with a `SupervisorAnswerContext` alias export. The proper fix is to rename one of the two types to eliminate ambiguity.

**Implementation:**
- Rename the per-question context type (in `SupervisorLLMPort.ts`) to `SupervisorQuestionContext` or `SupervisorAnswerContext` (formalise the EA13 workaround).
- Update all import sites.
- Remove the alias export if the rename makes it redundant.

**DoD:** `grep -r "SupervisorContext" packages/` shows exactly one type definition. Build green. No alias workarounds.

### E5 — Investigate 9 Pre-Existing SprintRunner Test Failures (EA14-S5)

9 test failures in `SprintRunner.test.ts` and `bmad-pipeline-e2e.test.ts` have been red since before EA13. They were inherited from the pre-EA11-S2 legacy path deprecation. EA13 confirmed they are not regressions.

**Implementation:**
- Triage each failure: is it testing deprecated code (post-EA11-S1/S2 deprecation), or is it testing active code with a broken fixture?
- For deprecated-path tests: either delete or skip with `// DEPRECATED: legacy path removed in EA11-S1/S2`.
- For active-code tests: fix the fixture or the test expectation.

**DoD:** `pnpm test` shows 0 failures (excluding intentional skips). Each skip has a documented rationale.

### E6 — Clean 13 Baseline Lint Errors (EA14-S6)

13 lint errors on the baseline commit `c9a2d99` prevent DoD from using "lint green" as a real gate. EA13 chose not to fix them (out of scope for empirical-gap work).

**Implementation:**
- Run `pnpm lint` from repo root, enumerate all errors.
- Fix each error (mostly unused imports, missing return types, or minor style violations based on prior sprint observations).
- Do not introduce new lint rules — fix against the existing configuration.

**DoD:** `pnpm lint` exits 0. No new lint suppressions added.

## 5. Implementation Handoff

### 5.1 Scope Classification

**Moderate.** New epic, 6 stories, three wiring fixes for the real-run path, three hygiene cleanups. No ADR changes. No schema break.

### 5.2 Stories Summary

| # | Story | Size | Depends on | Priority |
|---|---|---|---|---|
| 1 | EA14-S1 — BMAD bundle detection (pre-flight guard) | S | — | HIGH (blocks real-run) |
| 2 | EA14-S2 — Wire ExchangeHistoryWriter into session adapter | M | S1 | HIGH (blocks 3-track history) |
| 3 | EA14-S3 — Supervisor prompt commit_anchor guidance | S | — | HIGH (blocks real commits) |
| 4 | EA14-S4 — Resolve SupervisorContext name clash | S | — | MEDIUM (hygiene, can parallel) |
| 5 | EA14-S5 — Investigate 9 pre-existing test failures | M | — | MEDIUM (hygiene, can parallel) |
| 6 | EA14-S6 — Clean 13 baseline lint errors | S | — | MEDIUM (hygiene, can parallel) |

### 5.3 Success Criteria

1. `cop1 orchestrator run --epic EX1 --project-root /tmp/...` on a project with `_bmad/` installed produces:
   - `.cop1/history/EX1-S1/track1/`, `track2/`, `track3/` directories populated (S2 gate).
   - At least one real git commit with `Co-Authored-By` trailer (S3 gate).
   - Exit 1 with clear error when `_bmad/` is absent (S1 gate).
2. `pnpm build && pnpm test && pnpm lint` green from cold clone — zero test failures, zero lint errors (S5 + S6 gate).
3. No duplicate `SupervisorContext` type name in `@cop1/sprint-core` (S4 gate).
4. Stub runner still usable via `--runner stub` — existing tests not regressed.

### 5.4 Out of Scope (deferred to EA15 or later)

- Security mini-pass (AT-1..AT-6 from EA12 retro Review #2).
- Narrative catchup (EA12 retro action #5).
- Layer separation `*Core.ts` extraction (A3 from SCP 2026-04-15).
- Extract session lifecycle to sprint-core helper (EA13 retro #5).
- Register BMAD BMM slash commands as invokable skills (EA13 retro #6).
- EA8 Distribution stories.

## 6. Approval

**Auto-approved by the session-unique execution directive of 2026-04-18** — this SCP formalises the EA13 retro action items (section 6, priorities 2-4) combined with the three wiring gaps identified by the post-EA13 real-run analysis. No further approval loop.
