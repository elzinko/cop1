---
title: cop1 — Documentation index
generated: 2026-04-15 (document-project, adapted single-artefact mode)
status: working — the deep artefact is `brownfield-snapshot.md`; this index is a shortcut.
---

# cop1 — Documentation Index

> **Read first.** `docs/brownfield-snapshot.md` is the working deep document generated on 2026-04-15 to support an architecture confrontation session. Start there. Everything else here either feeds into it or is the authoritative source it summarizes.

## Working documents (this scan)

- [Brownfield Snapshot](./brownfield-snapshot.md) — identity, real package map, execution flows, ADR inventory, drift ledger, open confrontation points.
- [Getting Started](./GETTING_STARTED.md) — current user-facing contract (V1-light as of 2026-04-14).

## Authoritative planning artefacts

All live under `_bmad-output/planning-artifacts/`. Treat these as source-of-truth over any surface docs at the repo root.

### Product
- [`prd.md`](../_bmad-output/planning-artifacts/prd.md) — 823 L, edited through 2026-04-14. CA1–CA16, 139 active FRs, NFR1–34.
- [`epics.md`](../_bmad-output/planning-artifacts/epics.md) — 2645 L, epic/story catalog (E1–E12, EA1–EA11).
- [`ux-design-brief.md`](../_bmad-output/planning-artifacts/ux-design-brief.md) — UI horizon (Sprint 10+).

### Architecture
- [`architecture.md`](../_bmad-output/planning-artifacts/architecture.md) — 1608 L. Main decisions doc. For the current state, read §ADR-006 onwards.
- [`adr-010-iamthelaw-integration-consultation.md`](../_bmad-output/planning-artifacts/adr-010-iamthelaw-integration-consultation.md)
- [`adr-011-cop1-distribution-and-autonomous-orchestration.md`](../_bmad-output/planning-artifacts/adr-011-cop1-distribution-and-autonomous-orchestration.md)
- [`adr-012-multi-turn-bmad-interaction.md`](../_bmad-output/planning-artifacts/adr-012-multi-turn-bmad-interaction.md) — Agent SDK + LLM Supervisor.
- [`adr-013-orchestrator-sprintrunner-separation.md`](../_bmad-output/planning-artifacts/adr-013-orchestrator-sprintrunner-separation.md) — 525 L. EA10 seam.
- [`adr-014-supervisor-tool-interface.md`](../_bmad-output/planning-artifacts/adr-014-supervisor-tool-interface.md) — 1097 L. In-process MCP 6-tool catalog. **Most novel piece.**

### Sprint Change Proposals (chronological)

Listed in the snapshot §9. Latest two worth keeping warm:
- [`sprint-change-proposal-2026-04-14.md`](../_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-14.md) — PRD ↔ epics sync, EA4↔EA5 dep cycle break, EA11 reframe, NFR26–34 mapping, +E5-S13.
- [`sprint-change-proposal-2026-04-14-readiness-fixes.md`](../_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-14-readiness-fixes.md) — copy-paste epic patches.

### Implementation state
- [`sprint-status.yaml`](../_bmad-output/implementation-artifacts/sprint-status.yaml) — BMAD-owned, source-of-truth for story statuses (ADR-009).
- [`epic-ea10-ea11-retro-2026-04-14.md`](../_bmad-output/implementation-artifacts/epic-ea10-ea11-retro-2026-04-14.md) — most recent retro. Closes V1-light. Reveals V1.1 gaps.
- [`implementation-readiness-report-2026-04-14.md`](../_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-14.md) — post-SCP readiness check.
- [`supervisor-playbook-format.md`](../_bmad-output/planning-artifacts/supervisor-playbook-format.md) — playbook schema.
- [`supervisor-playbook-reference.md`](../_bmad-output/planning-artifacts/supervisor-playbook-reference.md) — canonical reference playbook.

## Runtime artefacts (not docs)
- [`supervisor-playbook.md`](../supervisor-playbook.md) — the minimal playbook the orchestrator loads by default.
- [`cop1.config.yaml`](../cop1.config.yaml) — runtime config (pre-pivot, mostly dormant — see snapshot §10.4).

## Pre-Phase-A archive

Four root-level docs that described the pre-pivot product (REST API, SQLite, old package names) were moved on 2026-04-15 to [`docs/archive/pre-phase-a/`](./archive/pre-phase-a/). `README.md` was rewritten to point here. See snapshot §10.1 for the drift analysis.

## What is NOT generated

The standard `document-project` workflow would normally emit `api-contracts.md`, `data-models.md`, `deployment-guide.md`, `integration-architecture.md`, and per-part architecture files. They are deliberately omitted here:
- No HTTP API surface today (REST planned Sprint 10+, see FR135 re-tagged).
- No database — persistence is file-based YAML + JSONL + markdown (see snapshot §6.3).
- No deployment target — local CLI, distribution deferred to EA8.
- Single-part project — integration is internal, already covered by the snapshot §5 flows.

When any of those surfaces becomes real, generate them then — not now.
