BMAD version: 6.0.0-Beta.8
help: /bmad-help
Epic/story restrictions: Process every story of the target epic (identified via `--epic <id>` at CLI invocation) in the order they appear in `_bmad-output/implementation-artifacts/sprint-status.yaml`. Stop at the first story whose status is `done`, `cancelled`, or otherwise out of the `ready-for-dev → review` transition range.
Worktree hooks: managed — each story runs in its own git worktree via `WorktreeService`. Cleanup on success, keep on failure for debugging.
Step-by-step hooks: transition-level — when `--step-by-step` is set, the orchestrator pauses between BMAD commands for manual approval (inter-command pause per EA10-S5; intra-command pause is EA8-S5 territory).
Decision policy: 3-tier supervisor cascade (deterministic match → LLM answer → terminal escalation). Advanced auto-decision policies (plan validation, elicitation selection, response validation with LLM-judge harness) are deferred to V1.1 per SCP 2026-04-11.

## Story Creation

1. `/bmad-bmm-create-story`

## Development Loop

1. `/bmad-bmm-dev-story`
2. `/bmad-bmm-code-review`
