# Sprint Change Proposal — 2026-03-09

**Date:** 2026-03-09
**Triggered by:** Epic EA1 Retrospective (2026-03-07)
**Reference:** `_bmad-output/implementation-artifacts/epic-ea1-retro-2026-03-07.md`
**Scope:** 5 changes — 1 blocker fix, 1 status update, 1 new epic, 1 process artifact, 1 infrastructure activation
**Approved by:** elzinko (Project Lead)

---

## Section 1: Issue Summary

The EA1 retrospective (2026-03-07) identified 5 action items requiring formal changes to project artifacts. EA1 is feature-complete (8/8 stories, 603 tests, 0 regressions) but revealed:

1. **Blocking bug:** `YamlStatusStore` points to wrong path — `cop1 sprint run` cannot work in production
2. **Stale status:** epic-ea1 still marked `in-progress` despite 8/8 stories done
3. **Missing validation capability:** Project Lead cannot test cop1 in isolation — no acceptance test harness exists
4. **Missing process artifact:** No formalized team Definition of Done — 5 HIGH bugs in EA1 could have been prevented
5. **Inert infrastructure:** iamthelaw rules engine coded but empty — no active rules, no sidecar

These items were discovered through systematic retrospective analysis after EA1 completion. Evidence includes 5 HIGH bugs found in code review (all at component boundaries), the YamlStatusStore path mismatch identified but not addressed since the E1-E12 retro (2026-02-22), and the Project Lead's inability to validate the product end-to-end.

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Impact | Detail |
|------|--------|--------|
| EA1 | Status update only | 8/8 done, status not updated to `done` |
| EA2 | **BLOCKED** by C1 | `cop1 sprint run` cannot function without YamlStatusStore fix. EA2-S3 to S6 cannot be validated in real conditions |
| EA3 | **Resequenced** | Moved from Sprint 10-11 to Sprint 12 to make room for EA6 |
| EA4 | **Resequenced** | Moved from Sprint 11-12 to Sprint 13 |
| EA6 | **NEW** | Acceptance Test Harness — inserted at Sprint 11 |
| E10, E11, E12 | No impact | Remaining backlog stories unaffected |

### Artifact Impact

| Artifact | Change | By |
|----------|--------|----|
| `sprint-status.yaml` | epic-ea1 → done, add EA6 entries | C2, C3 |
| `epics.md` | Add Epic EA6, update sprint ordering | C3 |
| `architecture.md` | ADR-009 already exists (2026-03-08) | C1 |
| Code: `YamlStatusStore` | Deprecated → replaced by `BmadStatusReader` | C1 |
| Code: `SprintRunner`, `DaemonService`, CLI, tests | Refactored to use `SprintStatusReaderPort` (read-only) | C1 |
| New file: team DoD | Pending architectural consultation on iamthelaw integration | C4 |
| New file: iamthelaw sidecar | Pending same consultation | C5 |

---

## Section 3: Recommended Approach

**Approach:** Direct Adjustment (hybrid — immediate stories + new epic)

All changes can be addressed within the existing project structure:
- C1, C2, C4 become technical stories in EA2 (next active sprint)
- C3 becomes a new epic (EA6) inserted before EA3
- C5 is blocked pending C4 consultation results

**Rationale:**
- No rollback needed — EA1 is complete and correct
- No MVP scope change — EA6 is a validation tool, not a product feature
- ADR-009 already documents the architectural decision for C1
- Timeline impact: +1 sprint (EA3 shifted from Sprint 10-11 to Sprint 12)

**Effort:** Medium overall
**Risk:** Low (ADR-009 specifies everything for C1, EA6 is additive)
**Timeline:** +1 sprint to accommodate EA6 before EA3

---

## Section 4: Detailed Change Proposals

### C2 — Update epic-ea1 status (EA2-S0)

**Story:** EA2-S0 — Update epic-ea1 status to done

```
Artifact: sprint-status.yaml

OLD:
  epic-ea1: in-progress  # 7 done (Sprint 8-9), 1 remaining (EA1-S8)

NEW:
  epic-ea1: done  # 8/8 stories done (Sprint 8-10), retro done
```

**Acceptance Criteria:**
- sprint-status.yaml shows `epic-ea1: done`
- Comment reflects reality (8/8 done)

**Effort:** Trivial | **Risk:** None

---

### C1 — ADR-009 BmadStatusReader refactoring (EA2-S0b)

**Story:** EA2-S0b — Implement ADR-009: SprintStatusReaderPort (read-only)

**Description:** Replace `YamlStatusStore` with `BmadStatusReader` in all cop1 components. cop1 becomes strictly read-only on `sprint-status.yaml`, per ADR-009.

**Work required:**
1. Create `SprintStatusReaderPort` (read-only interface)
2. Create `BmadStatusReader` (reads `_bmad-output/implementation-artifacts/sprint-status.yaml`)
3. Create `InMemoryStatusReader` (tests)
4. Refactor `SprintRunner`: remove `setStatus()`, use `BmadStatusReader`
5. Refactor `DaemonService`: replace `YamlStatusStore` with `BmadStatusReader`
6. Refactor `sprint-status` CLI: same
7. Adapt `bmad-pipeline-e2e.test.ts` to BMAD path + `InMemoryStatusReader`
8. Adapt `StoriesApiHandler.test.ts`: mock `SprintStatusReaderPort`
9. Deprecate `YamlStatusStore` (kept temporarily for legacy tests)

**Components impacted:**

| Component | Current | After |
|-----------|---------|-------|
| `SprintRunner` | Read + Write via `YamlStatusStore` | Read-only via `BmadStatusReader` |
| `DaemonService` | Read-only via `YamlStatusStore` | Read-only via `BmadStatusReader` |
| `sprint-status` CLI | Read-only via `YamlStatusStore` | Read-only via `BmadStatusReader` |
| `bmad-pipeline-e2e.test.ts` | Read + Write via `YamlStatusStore` | BMAD path + `InMemoryStatusReader` |
| `StoriesApiHandler.test.ts` | Mock `YamlStatusStore` | Mock `SprintStatusReaderPort` |

**Acceptance Criteria:**
- `SprintStatusReaderPort` exposed in sprint-core
- `BmadStatusReader` reads from `_bmad-output/implementation-artifacts/sprint-status.yaml`
- No `setStatus()` calls in `SprintRunner`
- cop1 NEVER writes to `sprint-status.yaml`
- All existing tests pass with the new reader
- `InMemoryStatusReader` used in all unit tests

**Effort:** Medium | **Risk:** Low (ADR-009 specifies everything)
**Priority:** BLOCKER — must be done before EA2-S3

---

### C4 — Consultation: iamthelaw as external dependency (EA2-S0c)

**Story:** EA2-S0c — Consultation: iamthelaw as external dependency

**Description:** Consult architect (Winston) and developers on integrating the `github.com/elzinko/iamthelaw` project as a cop1 dependency for rules and DoD management.

**Questions to resolve:**
1. `iamthelaw` as npm dependency vs integrated code in cop1?
2. How does BMAD already handle rules? Risk of duplication?
3. How to avoid coupling between BMAD methodology and the iamthelaw sidecar?
4. What pattern for the developer sidecar? (reading rules via iamthelaw)
5. How to improve iamthelaw and cop1 jointly?
6. Where should the team DoD file live?

**Output:** ADR or architectural recommendation

**Acceptance Criteria:**
- Integration model decision documented
- BMAD/iamthelaw coupling risks identified and mitigated
- Implementation plan for DoD creation and sidecar activation

**Effort:** Medium (consultation + analysis)
**Blocks:** C5 (sidecar activation) and team DoD file creation

---

### C5 — Activate iamthelaw sidecar (blocked by C4)

**Description:** Create sidecar with initial rules (R1-R5 from EA1 lessons) so BMAD agents can see them during execution.

**Initial rules (from EA1 retrospective):**

| # | Rule | Source |
|---|------|--------|
| R1 | Any component exposing a port must have an integration test with a real adapter (not just mocks) | EA1-S8 429 bug |
| R2 | Return values `false` vs `undefined` vs `null` must be documented in port contracts | EA1-S8 H1 |
| R3 | Barrel exports must be verified for every new public class | EA1-S4 review |
| R4 | Default values in code must exactly match story AC specifications | EA1-S7 timeout |
| R5 | Every story must have a story file in implementation-artifacts (traceability) | EA1-S1/S2/S3/S6 |

**Status:** BLOCKED — pending C4 consultation results on integration model
**Will become:** A story in the sprint following C4 resolution

---

### C3 — New Epic EA6: cop1 Acceptance Test Harness

**Epic:** EA6 — cop1 Acceptance Test Harness
**Position:** Sprint 11 (before EA3 Dashboard)

**User Value:** "I can launch a test, Claude works on a cobaye project with known challenges in <10 minutes, and I see a scoring matrix that tells me if cop1 is improving or regressing sprint after sprint."

**Architecture:**
- Pre-fabricated BMAD fixtures in `tests/acceptance/fixtures/` (epics, stories, sprint-status, architecture — generated by BMAD once, versioned with cop1)
- Setup script: `git init` tmpdir + copy fixtures → cobaye repo
- `cop1 sprint run` on cobaye repo via Claude proxy (`cursor-claude-connector`, OpenAI format)
- Config via env vars: `CLAUDE_PROXY_URL`, `CLAUDE_PROXY_API_KEY`
- Timestamped results stored in `tests/acceptance/results/`
- Multi-criteria scoring matrix (not binary pass/fail)

**Scoring matrix metrics:**
- Story completion rate (stories done / total)
- Code quality score (tests pass, lint clean, types ok)
- AC adherence (acceptance criteria respected)
- Review quality (bugs detected vs bugs planted)
- Retry efficiency (number of retries needed)
- Duration (total execution time)
- Inter-run comparison (delta per metric)

**Cobaye project (fixtures):**
- 1 epic, 2 stories minimum
- Documented planted traps (e.g., ambiguous AC, breaking test, non-trivial edge case)
- Complete BMAD structure (prd, epics, architecture, sprint-status) generated by BMAD upstream
- Enriched incrementally as new cases are discovered

**Stories:**

| Story | Title | Description |
|-------|-------|-------------|
| EA6-S1 | Acceptance test fixtures & scaffold | Create cobaye BMAD fixtures (via BMAD), setup script (git init + scaffold temp repo), 1 epic with 2 stories with documented planted traps, Claude proxy config (env vars) |
| EA6-S2 | Test runner & scoring matrix | Launch cop1 sprint run on cobaye repo, capture results (sprint-log, statuses, events), compute multi-criteria scoring matrix, store timestamped results |
| EA6-S3 | Regression detection & comparison | Compare results between successive runs, detect progression/regression per metric, markdown report with deltas and trends, CLI: `cop1 acceptance-test [--compare-last]` |
| EA6-S4 | Cobaye enrichment (optional, incremental) | Add stories/traps based on retro findings, document each trap and its expected score |

**Definition of Done:**
- `cop1 acceptance-test` launches the harness on a temp cobaye repo
- Cobaye contains at least 2 stories with documented planted traps
- Results are comparable between runs via scoring matrix
- Harness is isolated from the working repo (tmpdir)
- Comparison report detects at least 1 planted regression
- Execution completes in < 10 minutes with real Claude via proxy

**Notes:**
- No Docker required (Vercel proxy for Claude)
- Results CAN feed BMAD retros later, but NOT in this version
- No interference with iamthelaw or BMAD methodology
- Scoring is cop1-internal, stored in `tests/acceptance/results/`

**Dependencies:**
- EA2-S0b (ADR-009 BmadStatusReader) — cop1 sprint run must work
- cursor-claude-connector deployed on Vercel
- EA1 (BMAD pipeline) — DONE

---

## Section 5: Implementation Handoff

### Sprint Ordering (revised)

```
Sprint 10 (current):
  EA2-S0  — Update epic-ea1 status to done
  EA2-S0b — ADR-009 BmadStatusReader refactoring (BLOCKER)
  EA2-S0c — Consultation iamthelaw integration
  EA2-S3  — Budget alert system
  EA2-S4  — Pre-call budget check
  EA2-S5  — Budget CLI

Sprint 11:
  EA6-S1  — Acceptance test fixtures & scaffold
  EA6-S2  — Test runner & scoring matrix
  EA6-S3  — Regression detection & comparison
  EA6-S4  — Cobaye enrichment (optional)
  C5      — iamthelaw sidecar activation (if C4 resolved)

Sprint 12:
  EA3-S1 to EA3-S7 — Enhanced Dashboard

Sprint 13:
  EA4-S1 to EA4-S6 — Auto-Retro & Scrum Reconciliation
```

### Change Scope Classification

**Moderate** — Requires backlog reorganization (new epic insertion, sprint resequencing) and architectural consultation (iamthelaw integration).

### Handoff

| Role | Responsibility |
|------|---------------|
| SM (Bob) | Create stories EA2-S0, EA2-S0b, EA2-S0c via create-story workflow |
| Architect (Winston) | Lead C4 consultation on iamthelaw integration |
| Dev (Charlie) | Implement EA2-S0b (ADR-009 refactoring) |
| PO (Alice) | Validate EA6 story scope at sprint planning |
| Project Lead (elzinko) | Validate acceptance test harness scoring matrix |

### Artifacts to Update

| Artifact | Action | When |
|----------|--------|------|
| `sprint-status.yaml` | Update epic-ea1 → done, add EA2-S0/S0b/S0c, add EA6 entries | After approval |
| `epics.md` | Add Epic EA6 section, update sprint ordering | After approval |
| `architecture.md` | No change needed (ADR-009 already exists) | N/A |
| `prd.md` | No change needed (EA6 is validation tooling, not product feature) | N/A |

---

## Approval

- [x] Sprint Change Proposal reviewed by elzinko
- [x] All 5 change proposals approved individually (incremental mode)
- [x] Final approval: **YES** — 2026-03-09 by elzinko
- [x] Artifacts updated

---

*Generated by Correct Course workflow — 2026-03-09*
*Reference: epic-ea1-retro-2026-03-07.md*
