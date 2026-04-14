# Validation Report — EA10 + EA11 Stories (17 total)

**Date:** 2026-04-14
**Validator:** Claude Opus 4.6 (short-circuit BMAD checklist — critical issues + structural risks only)
**Scope:** EA11-S1..S8 + EA10-S1..S9 (V1-light MVP)
**Method:** Cross-checked each story's file paths, AC alignment with epics.md, dependency chain, and structural assumptions against the current codebase (`packages/`, `_bmad-output/`).

---

## Verdict summary

**Updated 2026-04-14 (post-fix pass):** All 4 critical issues resolved via Option A (co-locate — minimal structural churn). Story files rewritten.

| Story | Status | Notes |
|---|---|---|
| EA11-S1 | 🟢 Ready | |
| EA11-S2 | 🟢 Ready | |
| EA11-S3 | 🟢 Ready | Rewritten — services co-located in existing features (`dev-agent/`, `bmad-orchestration/`, `workflow/`) |
| EA11-S4 | 🟢 Ready (already done) | ADR committed |
| EA11-S5 | 🟢 Ready (already done) | ADR committed |
| EA11-S6 | 🟢 Ready | Rewritten — `SupervisorContextLoader` co-located with `SupervisorService` in `bmad-orchestration/` |
| EA11-S7 | 🟢 Ready | Updated import paths to EA11-S8 new location |
| EA11-S8 | 🟢 Ready | Rewritten — writers/readers in `bmad-orchestration/infrastructure/` |
| EA10-S1 | 🟢 Ready | |
| EA10-S2 | 🟢 Ready | |
| EA10-S3 | 🟢 Ready | |
| EA10-S4 | 🟢 Ready | References updated to new EA11 paths |
| EA10-S5 | 🟢 Ready | References updated |
| EA10-S6 | 🟢 Ready | |
| EA10-S7 | 🟢 Ready | Rewritten — ACs now reflect ADR-014 concrete decisions (in-process MCP via `createSdkMcpServer`, 3-layer architecture, named tool catalog, re-entrance guard) |
| EA10-S8 | 🟢 Ready | References updated |
| EA10-S9 | 🟢 Ready | Rewritten — Plan B added (fallback to local fixture + `InMemorySessionAdapter` if EA6 not ready) |

**Summary:** 17 🟢 ready-for-dev. Zero 🟡, zero 🔴.

---

## Resolutions applied (2026-04-14 fix pass)

- **C1 (history location):** Option A applied. `ExchangeHistoryWriter`, `MetricsWriter`, `ExchangeHistoryReader`, `HistoryService` all live in `packages/sprint-core/src/features/bmad-orchestration/` next to existing `SessionLogger` / `SessionHistoryReader`. No feature moves.
- **C2 (supervisor feature):** Option A applied. `SupervisorContext` type + `SupervisorContextLoader` co-located with `SupervisorService` in `features/bmad-orchestration/`. No new `features/supervisor/` module.
- **C3 (EA10-S7 concrete mechanism):** ADR-014 re-read and story rewritten. ACs now specify in-process MCP via `createSdkMcpServer`, 3-layer architecture (core / SDK wrapper / future standalone), tool catalog named per §4.4, supervisor-only scope per §5.1-§5.3, re-entrance guard on `invoke_bmad_command` per §5.7.
- **C4 (EA10-S9 Plan B):** Story updated with primary (EA6 cobaye) + Plan B (local fixture + `InMemorySessionAdapter`) paths. Story is now unblockable regardless of EA6 state.

---

## Original critical issues (historical)

### C1 — `features/history/` feature vs `bmad-orchestration/application/` (impacts EA11-S3, EA11-S8)

**Observation:** My stories propose moving `SessionLogger`, `SessionHistoryReader`, and the new `ExchangeHistoryWriter` / `MetricsWriter` / `ExchangeHistoryReader` into a new feature module `packages/sprint-core/src/features/history/`. Current reality: `SessionLogger.ts` + `SessionHistoryReader.ts` live in `packages/sprint-core/src/features/bmad-orchestration/application/`.

**Risk:** Moving them breaks imports across the codebase. Leaving them in `bmad-orchestration/` keeps the blast radius small but drifts from the epic's "extract services" framing.

**Recommendation:**
- **Option A (minimal risk):** Keep them in `bmad-orchestration/application/`. Only add the new writers/readers (`ExchangeHistoryWriter`, `MetricsWriter`, `ExchangeHistoryReader`) there too. Rewrite EA11-S3 and EA11-S8 story files to drop the `features/history/` move.
- **Option B (cleaner boundary, more work):** Create `features/history/` and migrate in one pass. Update all 19 useBMAD-mentioning files if needed.
- **Decision needed:** A vs B.

**Same call echoes in EA11-S3** where `HistoryService` placement depends on the above decision.

### C2 — `SupervisorContextLoader` placement (impacts EA11-S6)

**Observation:** EA11-S6 story places `SupervisorContextLoader` in a new `packages/sprint-core/src/features/supervisor/` feature. `SupervisorService` already lives in `packages/sprint-core/src/features/bmad-orchestration/application/SupervisorService.ts`.

**Risk:** Splitting supervisor-adjacent code across two features fragments the mental model.

**Recommendation:** Place `SupervisorContextLoader` next to `SupervisorService` in `bmad-orchestration/application/`. Reserve a future `features/supervisor/` for EA10 orchestrator-scope work if needed.

### C3 — "Per ADR-014" abstraction leak (impacts EA10-S7)

**Observation:** EA10-S7 defers many ACs to "the mechanism decided in ADR-014". ADR-014 is committed (git `539db6b`) but I did not re-read it for this validation pass.

**Risk:** The dev agent starts EA10-S7 and discovers ADR-014's decision (MCP vs Agent SDK tools vs sidecar) wasn't propagated into the AC text, then has to go hunt.

**Recommendation:** Before EA10-S7 starts, read `adr-014-supervisor-tool-interface.md` and rewrite EA10-S7 ACs with the **concrete mechanism** (e.g., "AgentSDK in-process tools registered via `query({ tools: […] })`"). Keeping EA10-S7 abstract is fine today (dev doesn't start this Sprint 12), but before Sprint 13 starts, refresh the story file.

### C4 — EA6 cobaye fixture doesn't exist yet (impacts EA10-S9)

**Observation:** EA10-S9 asserts use of "the EA6 cobaye project" fixture. EA6 is not yet implemented (no story files found for EA6 in `implementation-artifacts/`).

**Risk:** EA10-S9 blocks on EA6 being functional. Sprint 12 plans EA11 + EA6 in parallel per epics.md §Sprint 12; if EA6 slips, EA10-S9 slips.

**Recommendation:** Keep EA10-S9 AC1 as-is BUT add a "Plan B" note: if EA6 cobaye is not ready by the time EA10-S9 is picked up, use the existing `bmad-pipeline-e2e.test.ts` fixture in `packages/app/src/integration-tests/` with scripted `InMemorySessionAdapter` as a stopgap. This keeps EA10-S9 unblockable.

---

## Non-critical observations (tracked, NOT applied)

- **EA11-S1 template** — the `@deprecated` JSDoc template references `{@link BMADSessionPort}` which is currently exported from `bmad-orchestration`. If consumers import it via `@cop1/sprint-core` barrel, the `{@link}` resolves fine. Not an issue in practice.
- **EA10-S2 spec naming** — `supervisor-playbook-format.md` is acceptable; could also be `supervisor-playbook-spec.md`. Pure bikeshed.
- **EA10-S5 non-TTY fallback** — `COP1_APPROVAL_FILE` env var is a design I invented (not in epics.md). If this creates a CI contract ahead of demand, consider removing until someone asks for it.
- **EA10-S8 confidence formulas** — the formulas I wrote ("bucket (low/med/high) mapped to 0.3/0.6/0.9") are sensible starting points but not authoritative. Treat as hint, not spec.

---

## What I DID NOT re-validate

- Exhaustive PRD traceability per story (kept on trust for V1-light stories)
- Latest library version research (mentioned in BMAD checklist §2.5 — out of scope for this short-circuit pass)
- LLM-optimization pass on phrasing (kept as-is unless it caused ambiguity)
- Full cross-story dependency graph consistency (spot-checked only)

---

## Actionable next steps (recommended)

1. **Decide C1** (history feature vs bmad-orchestration) — 2 minutes with user. I'll rewrite the affected stories after.
2. **Decide C2** (supervisor feature) — 2 minutes. Quick fix.
3. **Before Sprint 13:** refresh EA10-S7 ACs with ADR-014's concrete decision.
4. **Before EA10-S9 is picked up:** confirm EA6 state and add Plan B note if needed.
5. Everything else in this report is informational.

**None of the 5 🟡 stories block Sprint 12 kickoff.** EA11-S1, S2, S4, S5, S7, S8 can all start without waiting on C1/C2 if we accept the current placement as "minimal risk" (Option A).
