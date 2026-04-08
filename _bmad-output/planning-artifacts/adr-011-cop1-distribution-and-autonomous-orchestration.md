# ADR-011 — cop1 Distribution, Installation & Autonomous Sprint Orchestration

**Date:** 2026-03-16
**Status:** Proposed
**Authors:** elzinko, Claude Opus 4.6
**Context:** Brainstorming session 2026-03-11 — Distribution, dogfooding et orchestration de cop1
**Supersedes:** None
**Related:** ADR-007 (2-layer architecture), ADR-010 (iamthelaw two-component), Epic EA7
**Source:** `_bmad-output/brainstorming/brainstorming-session-2026-03-11.md`
**Reviewed:** Adversarial review 2026-03-16 (13 findings, all addressed)

---

## 1. Executive Summary

This ADR formalizes how cop1 will be distributed, installed on target projects, and how it orchestrates autonomous sprints. The core decision is a **two-component distribution model** (BMAD method module + TypeScript CLI) with a **progressive orchestration strategy** — starting with the existing hardcoded pipeline and evolving toward a supervisor-guided loop.

Key decisions:

1. **Distribution:** BMAD external module `cop1-method` (published on npm, installed via `npx bmad-method install`) + global CLI `npm install -g @cop1/cli`
2. **Isolation:** Single git worktree per sprint, PR as sole integration point — no automatic merge, ever
3. **Orchestration V1:** Existing pipeline (dev → review → QA) unchanged. Supervisor agent is a future epic, not V1
4. **Dogfooding:** cop1 is a project like any other — same flow, same isolation, same PR review

---

## 2. Problem Statement

cop1 is currently developed as a monorepo project using BMAD interactively. Several questions remain unanswered:

1. **How will cop1 be packaged and installed on a target project?** It is not a simple npm dependency — it orchestrates external processes (Claude CLI sessions, git worktrees).
2. **How can cop1 be tested on itself (dogfooding)?** Without risking corruption of the BMAD files and code of the sprint in progress.
3. **How does cop1 decide what command to run next?** The sprint involves multiple sequential BMAD commands across isolated sessions.
4. **What is the boundary between cop1 and BMAD?** BMAD is declarative (markdown/yaml). cop1 is imperative (TypeScript). Where does one end and the other begin?

---

## 3. Constraints

- BMAD modules are **purely declarative** — markdown, YAML, CSV. No executable code. Cannot spawn processes. (Verified: zero TypeScript in any `_bmad/` module.)
- BMAD roadmap (docs.bmad-method.org/roadmap/) confirms **no plans for process orchestration** — "Dev Loop Automation" is listed as "optional" and cop1 fills this gap.
- Each BMAD agent/workflow requires its **own Claude CLI session** (BMAD method: one context per agent).
- Dogfooding must **NEVER alter** BMAD files or code of the current sprint on the main branch.
- Solution must be **progressive** — simple V1 with existing pipeline, evolvable toward supervisor-guided orchestration and multi-project/cloud.
- ADR-007 two-layer architecture must be respected: Layer 1 (BMAD interactive) and Layer 2 (cop1 autonomous) are conceptually separate, but **ADR-007 does not forbid cop1 from calling BMAD commands autonomously** — this is the explicit purpose of Layer 2 "night mode" (100% without human).

---

## 4. Decision: Two-Component Distribution Model

### 4.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  COMPONENT 1: BMAD MODULE "cop1-method"                     │
│  External module, published on npm (like bmb, tea, cis)     │
│  Installed in _bmad/cop1-method/ via npx bmad-method install│
│                                                             │
│  🤖 Agent: supervisor.md (sprint decision-maker) [FUTURE]  │
│  📋 Config: config.yaml (budget, timeouts, retry settings)  │
│  📖 module-help.csv (registered commands for bmad-help)     │
│                                                             │
│  Zero TypeScript — pure BMAD (markdown agents, YAML config) │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  COMPONENT 2: @cop1/cli (TypeScript engine)                 │
│  Installed globally via: npm install -g @cop1/cli           │
│                                                             │
│  🚀 SprintRunner: worktree creation, session spawning       │
│  🔄 Pipeline: dev → review → QA (existing, proven)         │
│  🌐 Daemon: HTTP server + web UI dashboard                  │
│  📊 Budget: token consumption tracking                      │
│  🔀 PR: GitHub PR creation from worktree branch             │
│  ✅ Checkpoint: resume after crash via CheckpointService     │
│                                                             │
│  TypeScript, spawns claude CLI for each BMAD command         │
│  Uses same ClaudeCliAdapter mechanism as today               │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Rationale

| Alternative considered | Rejected because |
|----------------------|-----------------|
| cop1 as npm devDependency in project | cop1 orchestrates processes — it's not a library, it's a tool |
| cop1 as pure BMAD module | BMAD cannot spawn processes or create worktrees (verified in code and roadmap) |
| cop1 as Docker-only | Too heavy for V1, limits local development |
| cop1 embedded in project | Must be isolated — runs across multiple projects (future) |

The two-component model mirrors ADR-010 (iamthelaw): BMAD module for declarative method + external tool for imperative execution.

### 4.3 Relationship to ADR-007 Two-Layer Architecture

This ADR is **consistent with** ADR-007:

- **Layer 1 (BMAD interactive):** Unchanged. Humans use BMAD directly for planning, solutioning, ceremonies.
- **Layer 2 (cop1 autonomous):** cop1 calls BMAD commands (slash commands) as tools via `spawn('claude', ['-p', command])`. This is the explicit "night mode" design from ADR-007 — Layer 2 uses Layer 1's tools autonomously. cop1 never modifies BMAD core files (`_bmad/core/`, `_bmad/bmm/`, etc.) — it is a read-only consumer, per ADR-007's file zones contract.

---

## 5. Decision: Installation Flow

### 5.1 Prerequisites

- BMAD must be installed on the target project (`_bmad/` directory exists)
- Claude CLI must be available in PATH
- Node.js >= 20.0.0

### 5.2 Installation Steps

```bash
# 1. Install cop1 CLI (global)
npm install -g @cop1/cli

# 2. Install BMAD on target project (if not already installed)
cd ~/my-project
npx bmad-method install
# → Select modules including cop1-method during interactive setup

# 3. Or add cop1-method module to existing BMAD project
npx bmad-method install
# → Select cop1-method module (existing modules are preserved)

# 4. Start cop1 pointing to the project
cop1 start --project ~/my-project
```

**Note on V1:** The cop1-method BMAD module may be installed manually (copy files to `_bmad/cop1-method/`) before it is published to the npm registry and available in the BMAD interactive installer. This is acceptable for early development and dogfooding.

### 5.3 Pre-flight Checks

When cop1 starts, it verifies:

| Check | Action if missing |
|-------|------------------|
| `_bmad/` directory exists | Block: "BMAD not installed. Run `npx bmad-method install` first." |
| `_bmad/cop1-method/` exists | Block: "cop1-method not installed. Add it via `npx bmad-method install` or copy manually." |
| `claude` in PATH | Block: "Claude CLI not found in PATH." |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Block: "No sprint-status.yaml found. Initialize your backlog with BMAD first." |

**Important:** If BMAD is already installed, cop1 does NOT reinstall it. Pre-flight checks are read-only.

---

## 6. Decision: Sprint Orchestration

### 6.1 V1 — Existing Pipeline (No Supervisor)

V1 uses the **existing proven pipeline** without changes:

```
SprintRunner
├── Create worktree from HEAD
├── FOR each story (ready-for-dev from sprint-status.yaml):
│   ├── Save checkpoint (storyId, stepIndex=0)
│   ├── BMADDevStoryStep  → spawn claude → /bmad-bmm-dev-story
│   ├── BMADReviewStep    → spawn claude → /bmad-bmm-code-review
│   ├── BMADQAStep        → spawn claude → /bmad-bmm-qa-automate
│   ├── Clear checkpoint
│   └── Check stop conditions
├── Sprint complete → create PR + demo link
└── Stop conditions: budget / error / human / max iterations / all done
```

This is the current `PipelineStepFactory.buildBMADSteps()` pipeline. No refactoring needed for V1.

### 6.2 Future Epic — Supervisor Agent

A future epic will add an **optional supervisor step** between the existing pipeline steps:

```
SprintRunner (with supervisor)
├── Create worktree from HEAD
├── LOOP:
│   ├── spawn claude → bmad-help (get methodological guidance)
│   ├── spawn claude → sprint-status (get current state)
│   ├── spawn claude → supervisor agent (decide next command)
│   │   Input: bmad-help output + sprint-status + last result
│   │   Output: next command to execute
│   ├── spawn claude → execute command
│   └── Check stop conditions
└── Sprint complete → create PR
```

**Key design decisions for the supervisor epic:**

- The supervisor is a **standard BMAD agent** (`_bmad/cop1-method/agents/supervisor.md`), invoked via the same `ClaudeCliAdapter` mechanism as all other BMAD commands: `spawn('claude', ['-p', prompt])` with context passed in the prompt and response parsed from JSON output.
- The supervisor is **stateless** — cop1 provides bmad-help + sprint-status as a fresh snapshot each iteration. cop1's existing `CheckpointService` and `SprintSessionService` continue managing execution state in TypeScript.
- The supervisor is **additive** — it inserts between existing steps, not replacing `PipelineStepFactory`. The hardcoded pipeline remains as fallback.
- The supervisor is **optional** — cop1 works without it (V1 pipeline). It becomes useful when the pipeline needs dynamic decisions (retry failed story? skip? escalate?).

### 6.3 Stop Conditions (All Versions)

The pipeline/loop terminates when **any** of these conditions is met:

| Condition | Description |
|-----------|-------------|
| Sprint complete | All eligible stories processed (done or failed) |
| Budget exhausted | Token consumption exceeds configured limit (existing BudgetService) |
| Unrecoverable error | Command fails with non-transient error after max retries (existing RetryPolicy) |
| Human interruption | User stops the sprint via UI or CLI (Ctrl+C / stop button) |
| Max iterations | Safety limit reached (prevents infinite loops) |

---

## 7. Decision: Sprint Isolation via Worktree

### 7.1 Execution Model

- Every sprint runs in a **single dedicated git worktree** created from current HEAD
- This is the existing `SprintRunner.createSimulateWorktree()` pattern (`{projectPath}/agent/simulate-{timestamp}`)
- The worktree contains a **complete copy** of the repo (code + `_bmad-output/`)
- All BMAD commands execute **inside the worktree** — main branch is never touched
- Both code changes AND `_bmad-output/` changes happen in the worktree
- **Note:** The legacy `DevAgent` per-story worktree pattern is NOT used in BMAD mode. In BMAD mode, Claude CLI handles file edits directly within the sprint worktree. One worktree per sprint is sufficient.

### 7.2 Sprint Lifecycle

```
main (untouched)
  │
  ├── git worktree add agent/simulate-{timestamp} HEAD
  │     │
  │     ├── cop1 runs sprint (modifies code + _bmad-output/)
  │     ├── Changes committed per-story in worktree branch
  │     └── PR created: sprint-{date} → main
  │
  ├── Human reviews PR (MANDATORY — no automatic merge, ever)
  │     ├── OK → merge PR → (rebuild & restart cop1 if dogfooding)
  │     └── KO → reject PR → worktree cleaned up, nothing changed
  │
  └── main remains intact until explicit human-approved merge
```

### 7.3 Crash Recovery

If cop1 crashes mid-sprint:

- The worktree remains on disk (partial state)
- The main branch is untouched
- **V1 strategy:** Use the existing `CheckpointService` to resume from the last completed story. The checkpoint file (`.cop1/checkpoint.yaml`) tracks `storyId + stepIndex + phase`. The `WorkflowEngine.resume()` method can restart from the saved step index. If checkpoint is corrupted or missing, fall back to discarding the worktree and restarting from scratch.
- **Existing code that supports this:** `CheckpointService.save()` (SprintRunner:142-149), `CheckpointService.read()` (SprintRunner:119), `WorkflowEngine.resume()` with `startIndex` from checkpoint.

---

## 8. Decision: Dogfooding

Dogfooding (cop1 developing itself) follows **the exact same flow** as any other project:

1. `cop1 start --project ~/git/cop1`
2. cop1 creates a worktree from current HEAD
3. Sprint executes in worktree (can modify SprintRunner, agents, anything)
4. PR created from worktree branch
5. **Human reviews and merges** (mandatory — no automatic merge)
6. Rebuild and restart cop1 with new code

**No special case needed.** The worktree isolation guarantees:

- **Filesystem safety:** Main branch files (code + `_bmad-output/`) are never touched during the sprint
- **Execution consistency:** cop1 runs the installed version throughout the sprint. The sprint may modify cop1's own code in the worktree, but the running process uses the original binary. This is standard behavior — identical to any CI/CD pipeline building its own toolchain.
- **Reversibility:** Reject the PR → nothing happened. The worktree is ephemeral.

**For consecutive sprints:** Each sprint creates a new worktree from the current HEAD. If a previous sprint's PR was merged, the new worktree picks up those changes. If not merged, the new worktree starts from the same base. No conflict possible.

---

## 9. Integration with iamthelaw (ADR-010)

The iamthelaw integration in the sprint execution loop is **already defined in ADR-010** and implemented (code exists, not yet wired):

- **Rule flow:** Retro → RuleProposalService → RuleApplicationService → SidecarSyncService → Agent consumption
- **DoD checks:** DoDService loads rules from `iamthelaw/global.yaml`, enforced between pipeline steps via quality gates in WorkflowEngine
- **Sidecar sync:** Event-driven via SidecarSyncListener (triggers on `rule.applied` and `rule.rejected` events)
- **Activation:** Epic EA7 will wire all existing services into DaemonService and SprintRunner

This ADR does not redefine iamthelaw integration. The sprint orchestration (Section 6) will invoke quality gates between steps, which in turn will call DoDService once EA7 is activated.

---

## 10. Future Evolution Path

| Phase | Scope | Description |
|-------|-------|-------------|
| **V1** | Single project, CLI, existing pipeline | `cop1 start --project`, one sprint at a time, manual BMAD install, checkpoint/resume |
| **V2** | Supervisor epic | Optional supervisor agent for dynamic step decisions (retry, skip, escalate) |
| **V3** | Multi-project | Dashboard managing multiple projects, sequential sprints |
| **V4** | Cloud/Teams | Cloud deployment, multi-team, rate-limit management module |
| **V5** | Full IDE experience | Rich UI, real-time sprint monitoring, CI integration |

Each phase builds on the previous one without breaking changes. The worktree + PR pattern scales to all phases.

---

## 11. Impact on Existing Architecture

### 11.1 V1 — New Components Required

| Component | Location | Type | Description |
|-----------|----------|------|-------------|
| Pre-flight checker | `@cop1/cli` | TypeScript | Validates BMAD, cop1-method, claude CLI presence |
| PR creator | `@cop1/cli` | TypeScript | Creates GitHub PR from worktree branch (via `gh` CLI) |
| cop1-method module | `_bmad/cop1-method/` | BMAD module | Config + module-help.csv (supervisor agent added in V2) |

### 11.2 V1 — Existing Components Affected

| Component | Change |
|-----------|--------|
| SprintRunner | Add worktree → PR creation flow after sprint completion. Ensure checkpoint works in worktree context. |
| ClaudeCliAdapter | No change — already spawns claude CLI correctly |
| PipelineStepFactory | No change in V1 — existing BMAD pipeline (dev → review → QA) is used as-is |
| DaemonService | Add sprint lifecycle endpoints (start, stop, status). Improve graceful shutdown to checkpoint before exit. |

### 11.3 V2 — Supervisor Epic Components

| Component | Location | Type | Description |
|-----------|----------|------|-------------|
| Supervisor agent | `_bmad/cop1-method/agents/supervisor.md` | BMAD agent (.md) | Stateless decision-maker, invoked via ClaudeCliAdapter |
| Supervisor step | `@cop1/cli` | TypeScript | New WorkflowStep that calls bmad-help + sprint-status + supervisor between existing steps |
| Stop conditions config | `_bmad/cop1-method/data/stop-conditions.yaml` | YAML | Configurable thresholds (max iterations, budget limits) |

### 11.4 New BMAD Module: cop1-method

```
_bmad/cop1-method/
├── config.yaml              # Module configuration (budget, timeouts)
├── module-help.csv          # Registered commands for bmad-help integration
├── agents/
│   └── supervisor.md        # Sprint supervisor agent [V2]
└── data/
    └── stop-conditions.yaml # Configurable stop condition thresholds
```

This module follows BMAD module standards:
- Standalone module type (independent domain, own agents/workflows)
- Installed in `_bmad/cop1-method/` (same pattern as bmb, tea, cis, gds)
- Published on npm for installation via `npx bmad-method install`
- Agent files use `.md` format (consistent with bmad-master.md, pm.md, dev.md)
- module-help.csv provides bmad-help integration

---

## 12. Open Questions (To Be Resolved in Implementation Stories)

1. **Supervisor prompt engineering (V2):** Exact format of the supervisor agent prompt. Will use the same `ClaudeCliAdapter` pattern — prompt with context in, JSON output parsed. To be specified in the supervisor epic.
2. **Demo link mechanism:** How to serve a local preview from a worktree. Options: local HTTP server in worktree, Docker container, or simple instructions in PR description. Non-blocking for V1 (PR description with manual instructions is sufficient).
3. **Step-by-step mode:** Debug mode where cop1 pauses between each command for human validation. Implementation: add `--step-by-step` flag to SprintRunner that prompts before each pipeline step. Separate story.
4. **Graceful shutdown:** Current DaemonService does `process.exit(0)` with no checkpoint. Must be improved to call `CheckpointService.save()` before exit on SIGTERM. Separate story.
5. **Rate limiting module (V4):** Token rate-limit tracking as complement to existing BudgetService. Needed when multi-project parallel execution is introduced. Not needed for V1 single-project mode.

---

## 13. Decision Record

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Two-component distribution (BMAD module + npm CLI) | BMAD cannot spawn processes; cop1 needs both method and engine |
| D2 | cop1 CLI is installed globally, not per-project | Will manage multiple projects in the future |
| D3 | BMAD must be pre-installed by user (cop1 checks, never installs) | Separation of concerns; BMAD installation is BMAD's responsibility |
| D4 | Single git worktree per sprint for isolation | Complete sandbox, zero risk to main branch. BMAD mode does not need per-story worktrees. |
| D5 | PR as sole integration point — no automatic merge, ever | Standard review flow, reversible via git, human approval mandatory |
| D6 | V1 uses existing hardcoded pipeline (dev → review → QA) | Proven, tested, no unnecessary complexity. Supervisor is a future epic. |
| D7 | Supervisor agent (future) is additive, not replacing pipeline | Inserts between existing steps. Pipeline remains as fallback. |
| D8 | Five stop conditions (all active, first triggered = stop) | Defense in depth against runaway execution |
| D9 | Dogfooding = same flow as any project, no special case | Worktree isolation + mandatory PR review makes it safe by design |
| D10 | V1 crash recovery uses existing CheckpointService | Resume from last completed story. Worktree preserved. Fall back to discard if checkpoint corrupted. |
| D11 | iamthelaw integration deferred to EA7 (already designed in ADR-010) | Code exists but is not wired. ADR-010 defines the integration. No duplication. |
| D12 | Consistent with ADR-007 two-layer architecture | Layer 2 (cop1) uses Layer 1 (BMAD) tools autonomously. Read-only consumer of BMAD core. Explicitly designed for "night mode". |
