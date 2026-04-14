# Supervisor Playbook Format — Specification

**Status:** Accepted (EA10-S2)
**Date:** 2026-04-14
**Author:** EA10 working set (SCP 2026-04-11)
**Consumers:** `SupervisorPlaybookLoader` (EA10-S1), `OrchestratorService` (EA10-S4), `cop1 orchestrator run` (EA10-S6).

## 1. Overview

A **supervisor playbook** is a markdown file that describes the canonical BMAD command sequence the cop1 Supervisor Orchestrator follows for a given run (V1-light: one epic). It is human-authored, human-readable, and strict enough for a tiny parser to load without ambiguity.

Minimum viable shape:

- Short YAML-ish preamble (plain text key/value lines) with version + help pointer
- One or more H2 phase sections, each containing an ordered list of BMAD slash commands
- Optional sections for epic restrictions, worktree/step-by-step hooks, decision policy

This spec is the contract between the author of a playbook and the loader.

## 2. Required sections

A valid playbook MUST contain:

### 2.1 BMAD version preamble

One line in the preamble (before the first H2) that identifies the BMAD release targeted by the playbook.

```
BMAD version: 6.0.0-Beta.8
```

- Pattern: `^BMAD version:\s*(.+)$`
- The value is stored verbatim. The parser does not version-check — that is an authoring concern.

### 2.2 `/bmad-help` pointer

One line pointing to the help command the supervisor invokes when unblocked by domain questions.

```
help: /bmad-help
```

- Pattern: `^help:\s*(\/.+)$`

### 2.3 Process sequence (≥ 1 phase)

At least one H2 section, each containing an ordered list with at least one command entry.

```
## Development Loop

1. `/bmad-bmm-dev-story`
2. `/bmad-bmm-code-review`
```

- H2 section header: `^##\s+(.+)$` — the captured text is the phase name
- Ordered-list item: `^\s*\d+\.\s+(.+)$` — the first backtick-wrapped `/`-slash or bare `/`-slash token in the item is the command
- Trailing text after the command (in the same list item) becomes an optional `note`

A phase with **zero** commands is a validation error.

## 3. Optional sections (preamble)

All below keys are single-line and live in the preamble (before the first H2). Any of them MAY be absent.

| Key | Semantics | Consumed by |
|---|---|---|
| `Epic/story restrictions:` | Free-form notes about which stories the loop runs over. | Orchestrator uses `--epic` flag; this text is informational only. |
| `Worktree hooks:` | How the orchestrator handles worktrees (e.g. `managed`, `shared`). | `SprintRunner` integration. |
| `Step-by-step hooks:` | When step-by-step pauses fire (e.g. `transition-level`, `intra-and-inter`). | `StepByStepController` in inter mode for EA10-S5. |
| `Decision policy:` | Reference to the supervisor's multi-step cascade. | `SupervisorService` (EA10-S8). |

## 4. Grammar rules

The parser is deliberately narrow.

| Rule | Enforced by |
|---|---|
| Preamble ends at the first `## ` header. | `parse()` |
| Phase = H2 heading + ordered list. | `parse()` |
| Nested lists are **ignored**. | `parse()` |
| Empty phases are a validation error. | `parse()` |
| Commands are validated against `.claude/commands/*.md`. | `validateCommands()` |

If more expressiveness is ever needed, switch to BMAD's `workflow.xml` format. **Do not** extend this markdown grammar (epics.md §EA10 Risk #3).

## 5. Validation rules

A playbook fails to load if:

1. No H2 phase is present (`PlaybookValidationError: Playbook has no H2 phases`).
2. A phase has no ordered-list commands (`PlaybookValidationError: Phase "<name>" has no ordered-list commands`).
3. A command in any phase does not match a file under `.claude/commands/` (`PlaybookValidationError: Unknown BMAD command: <cmd> (phase "<name>")`).

The loader does NOT validate:

- BMAD version compatibility
- Order of commands across phases
- Optional-section text content

## 6. Reference example

See: [`supervisor-playbook-reference.md`](./supervisor-playbook-reference.md)

## 7. Evolution

When this spec evolves, bump a `spec_version` line in the preamble and update `SupervisorPlaybookLoader` in lockstep. The loader currently tolerates unknown preamble keys, so adding new optional metadata is backwards-compatible.
