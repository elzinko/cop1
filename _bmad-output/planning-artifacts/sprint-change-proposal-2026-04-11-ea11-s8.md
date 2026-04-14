# Sprint Change Proposal — 2026-04-11 (Addendum: EA11-S8)

**Author**: elzinko (via Correct Course workflow)
**Date**: 2026-04-11
**Status**: Draft — pending approval
**Type**: Addendum to SCP 2026-04-11 (parent), tactical integration of a story surfaced during an architect session
**Parent**: `sprint-change-proposal-2026-04-11.md`
**Source of decision**: `adr-014-supervisor-tool-interface.md` §8.5, §9.1, §9.2

---

## Section 1 — Issue Summary

### Problem statement

The parent SCP 2026-04-11 scoped **Epic EA11 — Orchestrator Foundation** with **7 stories** (S1–S7) and mandated an architect session (EA11-S5) to produce **ADR-014 — Supervisor Tool Interface**.

During that architect session, the in-depth analysis of Q6 (supervisor history channel) revealed that the existing `SessionLogger` / `SessionHistoryReader` (current `bmad-orchestration` layer) must be **refactored** to carry a new file-based **3-tracks** persistence structure:

- **Track 2** — Exchange history: one markdown file per BMAD command invocation under `.cop1/history/{sprint}/{story}/`, committed to git unless opted out. Human-readable source for the transcript generator.
- **Track 3** — Metrics: daily JSONL under `.cop1/metrics/YYYY-MM-DD.jsonl`, gitignored, consumed by post-hoc analysis and rediffused via `EventBus` for SSE consumers.
- The dead `sprint-journal/` feature is deleted.
- The public `SessionInteraction` type and the `EventBus` integration must be preserved (contract-preserving migration).

This refactor is **a prerequisite for EA11-S7** (session transcript generator, which was originally specified against `NarrativeLog` JSONL — that source is the exact one being replaced). Without S8, S7 cannot be built.

### Discovery context

- Triggered by the EA11-S5 architect session on 2026-04-11
- Decision documented in ADR-014 §8.5 (subsume of legacy classes) and §9.2 (new story proposed to SCP)
- Re-estimated to **medium-large ~950–1350 LOC with tests** in ADR-014 §8.5 (initial intuition of 300–500 LOC proved optimistic)

### Evidence

- ADR-014 §8.5 — "Subsume du legacy `SessionLogger` / `SessionHistoryReader`" — rewrite decision with LOC table
- ADR-014 §9.1 — file-level impact (new writers/readers, refactored classes, deleted `sprint-journal/`)
- ADR-014 §9.2 — explicit call-out: *"Nouvelle story proposée au SCP : EA11-S8"*
- Code reference: `packages/sprint-core/src/features/bmad-orchestration/application/SessionLogger.ts` (87 LOC current), `SessionHistoryReader.ts` (167 LOC current), `packages/sprint-core/src/features/sprint-journal/` (stub dead)

---

## Section 2 — Impact Analysis

### Epic impact

| Epic | Status | Impact | Detail |
|---|---|---|---|
| EA11 | BACKLOG | **Scope expanded** | 7 → 8 stories, capacity watch raised |
| EA10 (Sprint 13) | BACKLOG | None | Tool names (`query_session_history`) already decided in ADR-014 §3 to avoid collision |
| EA3 (Sprint 16) | BACKLOG | Soft | Transcript files from Track 2 aggregation become an input option for EA3-S2 replay |
| All other epics | unchanged | None | |

No epic invalidated. No new epic required. Sprint 13+ unaffected because EA11-S8 lands in Sprint 12 alongside the rest of EA11.

### Story impact

**New story**:
- **EA11-S8** — Refactor `SessionLogger` / `SessionHistoryReader` to file-based 3-tracks structure. Sprint 12, medium-large ~950–1350 LOC with tests. Depends: EA11-S5 (ADR-014 approved). Blocks: EA11-S7.

**Modified story (dependency redirection)**:
- **EA11-S7** — Session transcript generator. Input source changes from `NarrativeLog` JSONL to Track 2 markdown files (`.cop1/history/`). Dependency on `NarrativeLogPort` replaced by dependency on `ExchangeHistoryReader` (produced by S8). No change in output contract (still a session-level markdown file + `cop1 transcript <session-id>` CLI).

**Sprint 12 internal ordering**: S8 listed before S7 in `epics.md` sprint ordering block, mirroring build dependency.

### Artifact conflicts

| Artefact | Conflict? | Action |
|---|---|---|
| PRD | None | Pure internal technical refactor — no functional requirement change |
| Architecture doc | Deferred | Updates listed in ADR-014 §9.3 (Components / Persistence / Legacy sections) are delivered **as part of EA11-S8 execution**, not in this SCP addendum, because they document the new structure that only exists once S8 lands |
| UX specs | None | CLI-first, no UI impact |
| `epics.md` | **Updated in this correction** | EA11 header bump (7 → 8), new story entry, technical-approach split into logging-refactor + transcript bullets, DoD enriched, risk #4 added (capacity watch), sprint ordering |
| `sprint-status.yaml` | **Updated in this correction** | EA11 block header annotated, S8 inserted before S7, S7 comment updated |
| SCP parent (`sprint-change-proposal-2026-04-11.md`) | None | Left untouched — historical record of what was decided at the time. This addendum captures the delta surfaced by the architect session it mandated. |

### Technical impact

- ~950–1350 LOC added / refactored (per ADR-014 §8.5 table)
- Legacy `sprint-journal/` feature deleted (dead stub)
- `SessionInteraction` public type preserved, `EventBus` integration preserved → no consumer break
- `.gitignore` auto-bootstrap guard with `--yes` flag (ADR-014 §8.6) → addresses first-run friction
- Test coverage: unit tests on writers/readers, fixture-based front-matter escape tests, integration test that exercises a full BMAD command invocation write-then-read cycle

---

## Section 3 — Recommended Approach

### Selected path

**Option 1 — Direct Adjustment** (add one story to an in-flight epic, modify one story's dependency, propagate to `sprint-status.yaml`).

### Rationale

1. **Expected outcome of the architect session** — The parent SCP explicitly slotted EA11-S5 as an architect session with Q1–Q6 agenda; finding that Q6 warranted a dedicated story is exactly the intended outcome, not a surprise.
2. **Low blast radius** — Two planning files touched (`epics.md`, `sprint-status.yaml`), one new SCP addendum written. No epic renumbering, no sprint re-sequencing, no dependency graph rewrite outside EA11.
3. **Preserves momentum** — Sprint 12 is not yet started; EA11-S8 can be planned in from day one rather than retro-fitted mid-sprint.
4. **Capacity watch, not capacity failure** — The re-estimate (~950–1350 LOC) is large for a single story but Sprint 12 still has slack: EA11-S1/S2 are XS pure deprecations with zero blocking dependencies, so they are the natural safety valve if velocity slips (mitigation documented as Risk #4 in `epics.md`).

### Trade-offs

- ✅ Accepted: Sprint 12 capacity gets tighter (8 stories instead of 7, one of them medium-large)
- ✅ Accepted: EA11-S7 dependency redirected from `NarrativeLogPort` to `ExchangeHistoryReader` — simpler in practice because Track 2 is already in conversation form
- ✅ Accepted: Architecture doc updates deferred to EA11-S8 execution instead of being done upfront here — correct because the doc should describe code that exists
- ⚠️ Non-negotiable: contract-preserving migration (`SessionInteraction` type + `EventBus` events must survive)

### Effort & risk estimate

- **Effort**: Low for this correction (3 small edits to planning files + 1 short SCP addendum). The work captured by EA11-S8 itself is medium-large, but that is the responsibility of Sprint 12 execution, not this correction.
- **Risk**: Low for the correction. Medium for S8 execution (capacity), already flagged as Risk #4 in `epics.md`.
- **Timeline impact**: 0 sprint drift. Mitigation path exists (defer S1/S2).

---

## Section 4 — Detailed Change Proposals

Edits below have already been applied to the repository during this Correct Course session.

### 4.1 — `epics.md` (Epic EA11 section, lines ~1138–1180 + sprint ordering block ~1275)

1. **Header** — `7 stories` → `8 stories` in the BLOCKING callout
2. **Technical approach bullet list** — split the "transcript generator" bullet into two bullets: (a) logging refactor (3-tracks), (b) transcript generator reading Track 2
3. **Stories list** — add EA11-S8 after EA11-S7; rewrite EA11-S7 to depend on EA11-S8 / Track 2 exchange history instead of `NarrativeLogPort`
4. **Definition of Done** — add bullet for the 3-tracks structure live; update the transcript-generator bullet to "aggregating Track 2 exchange files"
5. **Risks identified** — add Risk #4: EA11-S8 capacity overrun, mitigation = defer EA11-S1/S2
6. **Sprint 12 ordering block** — insert EA11-S8 between S6 and S7 with NEW / ADR-014 §8.5 / blocks S7 annotations; annotate S7 with "now reads Track 2 from S8"

### 4.2 — `sprint-status.yaml` (EA11 block, lines 341–354)

1. **Block header comments** — add "Updated 2026-04-11 — SCP 2026-04-11 addendum (EA11-S8 added from ADR-014 §8.5)"; update mission line to include "3-tracks logging"; bump the BLOCKING callout to "all 8 EA11 stories"
2. **Stories lines** — insert `EA11-S8: backlog` between S6 and S7 with full trailing-comment metadata; rewrite S7 trailing comment to reflect new input source (Track 2 markdown) and new dependency (EA11-S8)

### 4.3 — `architecture.md`

**Not touched in this correction.** The updates listed in ADR-014 §9.3 (add `ExchangeHistoryWriter`/`MetricsWriter` to Components, document `.cop1/history/` and `.cop1/metrics/` in Persistence, mark `NarrativeLogPort` obsolete in Legacy) are explicitly carried by **EA11-S8 execution** as accompanying documentation — they describe code that will only exist once S8 lands.

### 4.4 — `prd.md`

**Not touched.** No functional requirement change: EA11-S8 is a pure internal refactor.

---

## Section 5 — Implementation Handoff

### Scope classification

**Minor** — a planning-artifact integration of a decision already made and documented in ADR-014. The execution of EA11-S8 itself is a standard Sprint 12 story.

### Handoff recipients

**User (elzinko)** — Approve this SCP addendum. No further architect session required: ADR-014 §8.5 already holds the decision.

**Development team (Sprint 12)** — Pick up EA11-S8 alongside the rest of EA11. Implementation brief = ADR-014 §8.5 (rewrite scope), §9.1 (file-level impact), §8.6 (`.gitignore` auto-bootstrap), §8.5 LOC table. Pre-req: EA11-S5 (ADR-014) approved. Blocks: EA11-S7.

**PM / SM (already done in this session)** — `epics.md` and `sprint-status.yaml` updated in this Correct Course session, ready for Sprint 12 planning.

### Success criteria for EA11-S8

1. New `ExchangeHistoryWriter` produces real markdown files under `.cop1/history/{sprint}/{story}/` with front-matter escaping
2. New `MetricsWriter` produces daily JSONL under `.cop1/metrics/YYYY-MM-DD.jsonl` and rediffuses selected events via `EventBus`
3. `SessionLogger` and `SessionHistoryReader` refactored to route to both tracks
4. `SessionInteraction` public type and `EventBus` event types preserved (contract check in tests)
5. `sprint-journal/` feature deleted
6. `.gitignore` auto-bootstrap guard works (happy path + `--yes` path + refusal path)
7. EA11-S7 can consume Track 2 files to generate a session-level transcript (integration test)

### Blocking dependencies (delta only)

| Story | Blocked by (delta) |
|---|---|
| EA11-S7 | **now also EA11-S8** (input source redirection) |

All other dependencies from the parent SCP remain in place.

---

**End of addendum**
