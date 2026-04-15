---
title: Archive — pre-Phase-A docs
archived: 2026-04-15
reason: These documents describe the pre-pivot cop1 product (REST API, SQLite, `@cop1/domain`/`@cop1/api`/`@cop1/rules-engine` packages). None of that exists anymore. Kept for historical traceability only.
---

# Pre-Phase-A archive

Moved here on 2026-04-15 during the V1-light closure / V1.1 preparation cleanup. See `docs/brownfield-snapshot.md` §10.1 for the drift analysis that motivated the archive.

| File | Original location | Describes a world where |
|---|---|---|
| `MVP_STATUS.md` | repo root | a REST API was live on `:3000` with SQLite persistence. |
| `NEXT_SPRINT.md` | repo root | the sprint goal was "Backlog UI + Autonomous Mode prototype" with `TaskBoard.tsx` / `AutonomousMode.tsx`. |
| `QUICK_START.md` | repo root | `pnpm dev:all` existed, `@cop1/api` + `@cop1/domain` packages existed, `cop1.db` was the data store. |
| `ROADMAP.md` | repo root | epics were named "Backlog Management Interface", "Autonomous Work Mode", "BMAD Agents Integration". |

For the current, authoritative equivalents:
- **Onboarding** → `docs/GETTING_STARTED.md`
- **State of the product** → `docs/brownfield-snapshot.md`
- **Roadmap / epics** → `_bmad-output/planning-artifacts/epics.md`
- **Retro that closed V1-light** → `_bmad-output/implementation-artifacts/epic-ea10-ea11-retro-2026-04-14.md`

Do not reintroduce the content of these files without a Sprint Change Proposal.
