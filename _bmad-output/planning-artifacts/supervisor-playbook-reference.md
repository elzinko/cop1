BMAD version: 6.0.0-Beta.8
help: /bmad-help
Epic/story restrictions: Process every story of the target epic in the order they appear in sprint-status.yaml. Stop at the first 'done' or 'cancelled' story.
Worktree hooks: managed — each story runs in its own git worktree; cleanup on success, keep on failure.
Step-by-step hooks: transition-level — pause between BMAD commands when --step-by-step is set.
Decision policy: 3-tier supervisor cascade (deterministic → LLM → escalate). Advanced auto-decision policies deferred to V1.1.

## Story Creation

1. `/bmad-bmm-create-story`

## Development Loop

1. `/bmad-bmm-dev-story`
2. `/bmad-bmm-code-review`
