# Real-Run Report — cop1 orchestrator run (empirical shakedown)

**Date:** 2026-04-16
**Runner:** Claude (assisted by elzinko)
**Scope:** Execute `cop1 orchestrator run --epic <id>` on a fabricated example epic in a sandboxed `--project-root`, observe behavior, classify gaps. First response to EA12 retro action item #1 HIGH (BLOCKER for next review).
**Sandbox:** `/tmp/cop1-realrun-demo/` (primary) and `/tmp/cop1-realrun-demo-2/` (step-by-step variant). No mutation of the real project state.

---

## Setup

Example epic `EX1` with 2 stories:
- `EX1-S1` Say-Hello (status `ready-for-dev`)
- `EX1-S2` Add-Goodbye (status `backlog`)

Minimal `supervisor-playbook.md` (post-EA12-S3 format: scrum directives, no `commands:` map).

Binary used: `packages/app/dist/cli/index.js` from prior build (see Gap #1 below — `pnpm build` fails from scratch).

---

## Commands Executed

```bash
# Run 1 — normal mode
node dist/cli/index.js orchestrator run --epic EX1 --project-root /tmp/cop1-realrun-demo

# Run 2 — step-by-step mode (non-TTY stdin)
echo "a" | node dist/cli/index.js orchestrator run --epic EX1 \
  --project-root /tmp/cop1-realrun-demo-2 --step-by-step
```

Both exited **0** with: `Orchestrator finished: 2 stories, escalated=false, aborted=false`.

---

## What Worked (Plumbing OK)

| Layer | Signal |
|---|---|
| CLI binary | Loads, `--version` → `0.1.0`, `--help` renders correctly |
| Playbook loader (EA10-S1) | Parses post-EA12-S3 frontmatter format (no `commands:` map) |
| Story extraction (OrchestratorService.extractStoryKeysForEpic) | Correctly pulled `EX1-S1`, `EX1-S2` from `sprint-status.yaml` via prefix match |
| Default cycle fallback (EA12-S3 pivot) | Missing phase commands correctly fell back to `defaultCommandsForPhase` from sprint-core |
| Status transition persistence | `ready-for-dev → in-review → done` and `backlog → ready-for-dev → in-review → done` rewritten correctly in YAML |
| Auto-decision JSONL sink | 6 entries written to `.cop1/sprint-log-2026-04-15.jsonl`, one per (story × phase) |
| Step-by-step gate (non-TTY) | `InterCommandApprovalResolver` correctly defaulted to `continue` when no TTY and no `COP1_APPROVAL_FILE` (CI-safe behavior) |
| Exit code discipline | 0 on success; code paths for 1 (missing playbook), 2 (runtime error), 3 (aborted) present and reviewed |

---

## What Did NOT Happen (Gaps — the honest bit)

### Gap #1 — Build broken from scratch (BLOCKER for clean-clone reproducibility)

`pnpm build` fails with ~20 TS errors across 3 packages. Most severe:

```
InterCommandApprovalResolver.ts(3,15): error TS2305:
  Module '"@cop1/sprint-core"' has no exported member 'ApprovalResolver'.
```

Plus strict-null errors in `sprint-core` and `app` test files. The `dist/` directory from a prior successful build is what made this real-run possible. **A new developer cloning the repo today cannot build cop1.** This must be fixed before any dogfooding sign-off.

### Gap #2 — Default CLI runner is a stub (D7 carry-over materialized)

`packages/app/src/cli/commands/orchestrator.ts:25-32` wires a `stubRunner` that returns canned `ready-for-dev → in-review → done` transitions without any real BMAD invocation. The `overrides: { runner?: BMADCommandRunner }` parameter exists on line 36 but is **never passed from the CLI wiring** (`index.ts:75-77` forwards only `options`).

Consequence: `cop1 orchestrator run` today is a **state-machine simulator, not a real sprint**. The D7 tech debt ("BMADCommandRunner stub — real SprintRunner wiring") in the EA12 retro is the single most critical gap. Without it, none of EA9/EA10/EA11/EA12 investment is reachable from the CLI.

### Gap #3 — 3-track history not emitted

No `.cop1/history/` directory created. EA11-S8 tracks (Track 1 raw SDK, Track 2 markdown, Track 3 structured events) never fire because the stub runner bypasses `BMADSessionPort` / `SupervisorService` entirely. Track 2 extended format (EA12-S6) and session transcript generator (EA11-S7) have nothing to aggregate.

### Gap #4 — No commits, no GitDriver exercise

EA12-S1 delivered a real `commit_anchor`. It was not called. The sandbox dir is not even a git repo — but even in a git repo, the stub runner short-circuits commit creation.

### Gap #5 — No supervisor SDK session, no multi-agent advisory, no reentrance cap

EA9-S1/S2/S3 (session + supervisor), EA10-S7 (multi-agent), EA10-S8 (multi-step resolution), EA12-S5 (structured reentrance error) — all infrastructure present, none exercised. The stub never reaches a decision boundary.

### Gap #6 — Story body file is NOT updated by the orchestrator

`EX1-S1.md` body still says `## Status: ready-for-dev` after the run that marked it `done` in `sprint-status.yaml`. This directly confirms EA12 retro action item #4 (Story↔Session↔Commit triangle wiring, status MEDIUM) is still open. The run mutates only the YAML index, not the story markdown.

### Gap #7 — No worktree activity

Playbook declares "Worktree hooks: managed" but the stub runner short-circuits `WorktreeService`. Running inside a real git repo would likely surface plumbing issues not visible here.

---

## Failure Mode Classification

| Class | Count | Examples |
|---|---|---|
| Build / distribution | 1 | Gap #1 |
| Missing production wiring (infrastructure exists, unreachable from CLI) | 5 | Gaps #2, #3, #4, #5, #7 |
| Partial feature (from previous retro, confirmed unchanged) | 1 | Gap #6 |

**Meta-observation:** every gap is a *wiring* gap, not a missing feature. EA9/EA10/EA11/EA12 built the organs; the CLI never routes blood through them.

---

## Answer to Q1 from EA12 Retro Adversarial Review #1 (Economist)

> *"If you released EA12 tomorrow and a new user tried to run `cop1 orchestrator run --epic <small-real-epic>`, what fraction of the run would succeed unaided?"*

**Empirical answer:** The CLI exits 0 and produces a JSONL log plus a status-file update. But **0% of the promised behavior** happens: no BMAD command runs, no code is produced, no commit is created, no session is logged. From a product-pilot perspective, the run succeeds formally and fails totally.

---

## Recommended EA13 Scope (data-driven, replaces adversarial-review-driven scoping)

Order by empirical blocking:

1. **Fix Gap #1 — unblock `pnpm build`.** Non-negotiable. ~0.5–1 story. Required before anything else can be dogfooded or packaged.
2. **Fix Gap #2 — wire a real `BMADCommandRunner`.** D7 carry-over. Should delegate to `SprintRunner` via `BMADSessionPort`. Make it the default; keep the stub factory usable for tests only. This is the single change that turns the simulator into a real sprint engine.
3. **Validation run #2 — re-run this exact procedure after #1 + #2.** If Track 1/2/3 history emits and at least one real commit is produced on a sandbox epic, the "real run" gate is passed.
4. **Fix Gap #6 — Story↔Session↔Commit wiring.** After #2, required for the supervisor to produce self-documenting outcomes on the story file.
5. Security mini-pass (AT-1..AT-6 from EA12 retro Review #2) — after #3 empirical signal.
6. Narrative catchup (EA12 retro action #5) — after #3.

Items 1 + 2 + 3 + 4 = the minimum path to a genuinely runnable product. Suggest packaging them as `epic-ea13 — Orchestrator Wiring & Build Fix` and deferring the security/narrative work to EA14 until empirical coverage exists.

---

## Reproduction

Anyone rebuilding this test:

```bash
# Sandbox setup
mkdir -p /tmp/cop1-test/_bmad-output/implementation-artifacts
cat > /tmp/cop1-test/supervisor-playbook.md <<'EOF'
BMAD version: 6.0.0-Beta.8
help: /bmad-help

## Mission
Smoke test.
## Development Loop
Canonical scrum cycle.
## Escalation Policy
Escalate on reentrance cap or budget exhaustion.
EOF
cat > /tmp/cop1-test/_bmad-output/implementation-artifacts/sprint-status.yaml <<'EOF'
generated: 2026-04-16
project: smoke
project_key: NOKEY
tracking_system: file-system
story_location: _bmad-output/implementation-artifacts
development_status:
  epic-ex1: in-progress
  EX1-S1: ready-for-dev
  epic-ex1-retrospective: optional
EOF

# Run
node /path/to/cop1/packages/app/dist/cli/index.js orchestrator run \
  --epic EX1 --project-root /tmp/cop1-test
```

Expected today: exit 0, `Orchestrator finished: 1 stories, escalated=false, aborted=false`, JSONL log with 3 fake auto-decisions, `sprint-status.yaml` flipped to `EX1-S1: done`. No commits, no history, no sessions.

Expected after EA13 Gaps #1+#2 fix: same exit, plus `.cop1/history/EX1-S1/` with track1/2/3 files, plus at least one real git commit with Co-Authored-By trailer, plus `EX1-S1.md` body reflecting the new status.

---

## Next Step for elzinko

Read this report. If classification matches your reading, either:
- approve an **EA13 "Orchestrator Wiring & Build Fix" scope** (items 1 + 2 + 3 + 4 above) and let me generate `epic-ea13.md` + story files; or
- ask for a specific gap to be investigated deeper before scoping.

The retro's "no two review-driven sprints in a row" rule is satisfied: this report is the empirical data the next sprint-planning should consume.
