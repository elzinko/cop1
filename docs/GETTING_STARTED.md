# Getting Started with cop1

> **Status (2026-04-14):** V1-light MVP closed. The Supervisor Orchestrator CLI (`cop1 orchestrator run`) is shipped as a walking skeleton — the inter-command loop, playbook, step-by-step mode, and 3-tracks logging work end-to-end. The `BMADCommandRunner` is still a stub (V1.1 hardening): real BMAD execution + real commits are not wired yet.

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- Git
- (For interactive runs) A BMAD installation in the target project (`_bmad/`) and Claude Code CLI

## Install + Build

```bash
pnpm install
pnpm build       # builds all 7 workspace packages
pnpm test        # ~850 tests, should all pass
pnpm typecheck   # clean on `@cop1/sprint-core` and `@cop1/app`
```

## Package Layout

```
packages/
  shared-kernel/        — EventBus, shared types
  observability/        — logging, metrics primitives
  quality-intelligence/ — quality gates, drift detection
  sprint-core/          — BMAD orchestration, supervisor, sessions (hex architecture)
  llm-intelligence/     — LLM gateway + routing
  ceremony-engine/      — ceremonies (planning, retro, grooming)
  app/                  — CLI entry point (orchestrator, daemon, transcript)
  web/                  — React dashboard (optional)
```

## Running the Supervisor Orchestrator (V1-light)

The orchestrator walks an epic's stories in order, invoking BMAD commands per phase (create-story → dev-story → code-review), pausing for supervisor decisions or human approvals.

### 1. Define a playbook

A playbook is markdown that declares the command sequence. The project root contains a minimal one at `supervisor-playbook.md`. Example:

```markdown
BMAD version: 6.0.0-Beta.8

## Story Creation
1. /bmad-bmm-create-story

## Development Loop
1. /bmad-bmm-dev-story
2. /bmad-bmm-code-review
```

Format reference: `_bmad-output/planning-artifacts/supervisor-playbook-format.md`.

### 2. Launch on a target epic

```bash
# Normal mode — runs through the whole epic without pauses
node packages/app/dist/cli/daemon-entry.js orchestrator run --epic <epicId>

# Step-by-step — pauses between commands for manual approval (TTY prompt, or COP1_APPROVAL_FILE)
node packages/app/dist/cli/daemon-entry.js orchestrator run --epic <epicId> --step-by-step

# Abort on escalation — stop the run as soon as the supervisor escalates
node packages/app/dist/cli/daemon-entry.js orchestrator run --epic <epicId> --abort-on-escalation

# Custom playbook location
node packages/app/dist/cli/daemon-entry.js orchestrator run --epic <epicId> --playbook path/to/playbook.md
```

Exit codes: `0` success, `2` runtime error, `3` aborted on escalation.

### 3. Inspect outputs

Each run emits three tracks (ADR-014 §8.5):

```bash
# Track 1 — SDK session state (opaque, managed by Agent SDK)
# Track 2 — human-readable exchange history (markdown)
ls .cop1/history/

# Track 3 — structured metrics (JSONL per exchange)
ls .cop1/metrics/

# Auto-decision log (supervisor decisions per turn)
cat .cop1/sprint-log-$(date +%Y-%m-%d).jsonl
```

### 4. Read a session transcript

```bash
node packages/app/dist/cli/daemon-entry.js transcript <sessionId>
```

Aggregates Track 2 markdown into a readable transcript.

## What Works Today (V1-light)

- Playbook parsing → typed domain model (EA10-S1)
- Inter-command orchestrator loop with state transitions (EA10-S4)
- Inter-command step-by-step approval (TTY / `COP1_APPROVAL_FILE` / CI no-op) (EA10-S5)
- CLI subcommand (EA10-S6)
- In-process MCP tool catalog for the supervisor (6 tools, ADR-014 §4.2) (EA10-S7)
- Supervisor decision cascade (deterministic → LLM → escalation) (EA9-S3 + EA10-S8)
- 3-tracks persistence + session transcript (EA11-S7/S8)
- Worktree-per-story execution (EA11-S3 via `WorktreeService`)

## What Is Stubbed Today

- `BMADCommandRunner` is a no-op that just transitions story status (no real BMAD execution)
- `commit_anchor` tool returns a stub (no real git commits per story)
- `EA10-S9` E2E test uses a local scripted fixture instead of a real cobaye project (EA6 scope)

See `_bmad-output/implementation-artifacts/epic-ea10-ea11-retro-2026-04-14.md` for the full gap list and V1.1 priorities.

## Current Interactive Workflow (Pre-V1.1)

Until `commit_anchor` + real `BMADCommandRunner` land, the practical workflow is manual driving through Claude Code:

1. Pick the next `ready-for-dev` story from `_bmad-output/implementation-artifacts/sprint-status.yaml`
2. Run `/bmad-bmm-dev-story` in Claude Code
3. Run `/bmad-bmm-code-review`
4. Commit (1 commit per story, conventional format)
5. Update story status to `done` in `sprint-status.yaml`

This is exactly the pattern the supervisor orchestrator will automate in V1.1.

## Architecture

cop1 uses hexagonal architecture across the packages:

- **Domain ports** (interfaces): `BMADSessionPort`, `SupervisorLLMPort`, `BMADCommandRunner`
- **Application services**: `SupervisorService`, `OrchestratorService`, `HistoryService`, `WorktreeService`, `StepByStepController`
- **Infrastructure adapters**: `AgentSdkSessionAdapter` (Agent SDK), `ClaudeResumeSessionAdapter` (CLI fallback), `InMemorySessionAdapter` (tests)

Key ADRs to read:
- `_bmad-output/planning-artifacts/adr-012-multi-turn-bmad-interaction.md` — multi-turn session pattern
- `_bmad-output/planning-artifacts/adr-013-orchestrator-sprintrunner-separation.md` — inter- vs intra-command boundary
- `_bmad-output/planning-artifacts/adr-014-supervisor-tool-interface.md` — in-process MCP tool catalog (most novel piece)

## Troubleshooting

### `Failed to load playbook`
- Check `supervisor-playbook.md` exists at project root (or pass `--playbook <path>`)
- Validate format against `supervisor-playbook-format.md`

### Orchestrator exits with code 3
- Expected when `--abort-on-escalation` is set and the supervisor escalates
- Inspect `.cop1/sprint-log-*.jsonl` for the last decision

### No visible effect on the codebase
- Expected today: `BMADCommandRunner` is a stub. Story statuses transition in `sprint-status.yaml` but no code is generated. V1.1 hardening will wire real BMAD execution.

## Further Reading

- `docs/architecture.md` — system architecture
- `_bmad-output/planning-artifacts/prd.md` — product requirements
- `_bmad-output/planning-artifacts/epics.md` — epic catalog
- `_bmad-output/implementation-artifacts/epic-ea10-ea11-retro-2026-04-14.md` — latest retro + V1.1 priorities
