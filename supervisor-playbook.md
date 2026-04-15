BMAD version: 6.0.0-Beta.8
help: /bmad-help
Epic/story restrictions: Process every story of the target epic (identified via `--epic <id>` at CLI invocation) in the order they appear in `_bmad-output/implementation-artifacts/sprint-status.yaml`. Stop at the first story whose status is `done`, `cancelled`, or otherwise out of the `ready-for-dev → review` transition range.
Worktree hooks: managed — each story runs in its own git worktree via `WorktreeService`. Cleanup on success, keep on failure for debugging.
Step-by-step hooks: transition-level — when `--step-by-step` is set, the orchestrator pauses between BMAD commands for manual approval (inter-command pause per EA10-S5; intra-command pause is EA8-S5 territory).
Decision policy: 3-tier supervisor cascade (deterministic match → LLM answer → terminal escalation). Advanced auto-decision policies (plan validation, elicitation selection, response validation with LLM-judge harness) are deferred to V1.1 per SCP 2026-04-11.
Decision authority: The supervisor has final authority on naming, placement, and scope-minor choices inside a story. Architectural decisions, playbook edits, and any deviation from the scrum cycle must be escalated. BMAD command selection is the supervisor's call — discover the command surface via `/bmad-help` and `_bmad/bmm/**`; do not expect an allowlist.

## Mission

Run the cop1 orchestrator end-to-end on a single target epic, producing committed, reviewable work for each story. Succeed when every story in the epic reaches `done` (or is terminally escalated) with a clean gate (tests + lint) and a real commit anchored in git history.

## Story Creation

The first phase of each story brings it from `backlog`/`ready-for-dev` to implementation-ready state. The supervisor uses the appropriate BMAD story-authoring workflow (discovered via `/bmad-help`) and consults `_bmad-output/implementation-artifacts/*.md` for fixture content. Escalate if BMAD reports DoR gaps that cannot be resolved by reading the epic file.

## Development Loop

For each ready-for-dev story, the supervisor drives the canonical scrum cycle: implement the story's acceptance criteria, record the work via the code-review workflow, and validate against the quality gate. The supervisor is free to substitute or reorder BMAD commands when the story shape demands it (e.g., spike stories without review steps, refactors without QA). The default cycle commands are codified in `packages/sprint-core/src/features/bmad-orchestration/domain/BmadCycle.ts` — edit there, not here, if the canonical cycle changes.

## Escalation Policy

Escalate — do NOT loop — when:

- The question cannot be answered from the story AC + project-context + architecture.md + iamthelaw rules.
- A BMAD workflow reports a blocker that requires product/design input.
- The re-entrance cap is hit (structured `reentrance_cap` error from the supervisor tool).
- Budget check returns `no_budget_provider` or the per-night token cap is exhausted.

Escalation produces a `supervisor escalation` outcome on the story and pauses the orchestrator (mode-dependent). The human developer resumes after resolving the blocker.
