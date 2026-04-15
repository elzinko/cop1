BMAD version: 6.0.0-Beta.8
help: /bmad-help
Epic/story restrictions: Process every story of the target epic in the order they appear in sprint-status.yaml. Stop at the first 'done' or 'cancelled' story.
Worktree hooks: managed — each story runs in its own git worktree; cleanup on success, keep on failure.
Step-by-step hooks: transition-level — pause between BMAD commands when --step-by-step is set.
Decision policy: 3-tier supervisor cascade (deterministic → LLM → escalate). Advanced auto-decision policies deferred to V1.1.
Decision authority: supervisor final on naming/placement/scope-minor; escalate on architecture + playbook edits. Command surface not allowlisted — discovery via /bmad-help.

## Mission

End-to-end run on one target epic: every story reaches `done` or terminal escalation with clean gate + real commit.

## Story Creation

Bring a story from `backlog`/`ready-for-dev` to implementation-ready. Use the BMAD story-authoring workflow (discovered at runtime via /bmad-help).

## Development Loop

Canonical cycle: implement AC, record the work via code-review, validate via quality gate. Default commands live in `packages/sprint-core/src/features/bmad-orchestration/domain/BmadCycle.ts`.

## Escalation Policy

Escalate on unresolved AC/context gaps, BMAD-reported blockers, `reentrance_cap`, budget exhaustion.
