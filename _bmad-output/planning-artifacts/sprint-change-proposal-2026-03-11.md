# Sprint Change Proposal — 2026-03-11

**Date:** 2026-03-11
**Triggered by:** EA2-S0c Consultation iamthelaw — Architecture Evolution
**Reference:** `_bmad-output/planning-artifacts/adr-010-iamthelaw-integration-consultation.md`
**Previous SCP:** `_bmad-output/planning-artifacts/sprint-change-proposal-2026-03-09.md`
**Scope:** 5 changes — 1 model enrichment, 1 ADR update, 1 new epic, 1 dependency update, 1 sprint resequencing
**Approved by:** elzinko (Project Lead) — 2026-03-11

---

## Section 1: Issue Summary

The EA2-S0c consultation (iamthelaw integration) produced ADR-010 on 2026-03-09, recommending integrated code in cop1. However, the architectural discussion evolved beyond the initial scope. The project lead identified a broader vision:

1. **iamthelaw should be independent** — reusable outside cop1/BMAD, installable in any BMAD project
2. **Agents should interact with rules natively** — retro agents create rules, all agents read rules automatically
3. **Infrastructure must be LLM-independent** — storage and querying should not depend on LLM capabilities
4. **The cop1 domain model is better** — categories (global/scrum/architecture/agents) map well to BMAD agent roles, but need severity levels (MUST/SHOULD/MAY) from iamthelaw

The consultation concluded with a **two-component architecture**: a standalone BMAD module for interactive rule management + cop1 as the programmatic infrastructure with a REST API.

### Evidence

| Evidence | Source |
|----------|--------|
| cop1 code complete but inert (zero rules on disk) | ADR-010 §2.2, EA1 retro §6 |
| cop1 model = categories (global/scrum/arch/agents) | `RuleSet.ts` in sprint-core |
| Missing severity levels in Rule interface | Domain analysis |
| No REST API for rule querying | HttpServer analysis |
| BMAD module system supports standalone modules | BMAD module-standards.md |
| 7 cop1 services depend on current RuleSet model | IamTheLawLoader, SidecarSyncService, SidecarSyncListener, FileSidecarAdapter, RuleApplicationService, DoDService, BmadBridgeService |

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Impact | Detail |
|------|--------|--------|
| EA2 | **Minimal** | EA2-S0c completed with consultation results. Budget stories S3-S6 unaffected |
| EA3 | **Resequenced** | Moved from Sprint 12 to Sprint 13 (make room for EA7) |
| EA4 | **Modified + Resequenced** | EA4-S6 (retro-to-rules) gains dependency on EA7. Moved from Sprint 13 to Sprint 14 |
| EA6 | **No impact** | Acceptance Test Harness stays in Sprint 11 |
| EA7 | **NEW** | iamthelaw Module BMAD & API REST — Sprint 12 |
| E9 | **No impact** | Existing code enriched, not replaced |
| E10, E11, E12 | **No impact** | Remaining backlog stories unaffected |

### Artifact Impact

| Artifact | Change | Proposal |
|----------|--------|----------|
| `RuleSet.ts` (sprint-core) | Add `level?: 'MUST' \| 'SHOULD' \| 'MAY'` to Rule interface | C1 |
| ADR-010 | Update with two-component architecture decision | C2 |
| `epics.md` | Add Epic EA7, update EA4-S6 dependencies | C3, C4 |
| `sprint-status.yaml` | Add EA7 entries, resequence sprints | C3, C5 |
| `architecture.md` | No change needed (ADR-010 is the reference) | N/A |
| `prd.md` | No change needed (enrichment, not scope change) | N/A |

### Technical Impact

| Component | Impact | Detail |
|-----------|--------|--------|
| `Rule` interface | Minor | Add optional `level` field — backward compatible |
| `IamTheLawLoader` | Minor | Parse `level` from YAML files |
| `SidecarSyncService` | Minor | Include level in markdown output |
| `HttpServer` | Moderate | New `RulesApiHandler` (same pattern as `StoriesApiHandler`) |
| Module BMAD | New | Agent Judge Dredd + workflows (retro-to-rules, export/import) |
| `DoDService` | None | Unaffected — reads from global.yaml as before |

---

## Section 3: Recommended Approach

**Approach:** Direct Adjustment (hybrid — model enrichment + new epic)

All changes can be addressed within the existing project structure:
- C1 (Rule model enrichment) is a backward-compatible code change
- C2 (ADR-010 update) is a document update reflecting the evolved consultation
- C3 (Epic EA7) is a new epic inserted at Sprint 12
- C4 (EA4-S6 dependency) is a dependency and description update
- C5 (Sprint resequencing) shifts EA3 and EA4 by one sprint each

### Rationale

- **No rollback needed** — existing iamthelaw code is good, we enrich it
- **No MVP scope change** — EA7 strengthens the existing rules engine vision
- **Low technical risk** — follows established patterns (HttpServer handlers, BMAD modules)
- **Clear dependency chain** — EA7 before EA4-S6 ensures retro-to-rules has the infrastructure it needs
- **Reusability** — BMAD module is installable in any BMAD project, not cop1-specific

### Effort & Timeline

- **Effort:** Medium overall (7 stories in EA7, most are small-medium)
- **Risk:** Low (enrichment of existing code, new module follows BMAD standards)
- **Timeline impact:** +1 sprint (EA3: 12→13, EA4: 13→14)

---

## Section 4: Detailed Change Proposals

### C1 — Enrich Rule model with severity levels

**Artifact:** `packages/sprint-core/src/features/iamthelaw/domain/RuleSet.ts`

```
OLD:
export interface Rule {
  id: string;
  description: string;
  source: string;
}

NEW:
export interface Rule {
  id: string;
  description: string;
  source: string;
  level?: 'MUST' | 'SHOULD' | 'MAY';
}
```

**Rationale:** Add iamthelaw severity levels to the cop1 model. Backward compatible — `level` is optional, defaults to `MUST` if absent. Enables DoDService to distinguish mandatory vs recommended rules.

**Effort:** Trivial | **Risk:** None

---

### C2 — Update ADR-010: Two-component architecture

**Artifact:** `_bmad-output/planning-artifacts/adr-010-iamthelaw-integration-consultation.md`

**Changes:**
- Section 3 (Decision): Replace "Integrated code in cop1 (status quo)" with "Two-component architecture — BMAD Module + cop1 programmatic API"
- Add architecture description:
  1. **Module BMAD "iamthelaw" (standalone)** — Agent Judge Dredd, workflows retro-to-rules/export/import, sidecar rules.md, installable in any BMAD project, zero TypeScript code
  2. **cop1 (programmatic consumer)** — API REST /api/rules, enriched Rule domain, existing services (Loader, Sync, Application), shared filesystem contract (iamthelaw/*.yaml)
- Section 9 (Decision Summary): Add Q7 (Module BMAD standalone), Q8 (API REST /api/rules), Q9 (cop1 model enriched with levels)
- Update rationale to reflect the evolved consultation

**Rationale:** The consultation evolved beyond the initial 6 questions. ADR-010 is updated (not replaced) to document the final architectural vision.

**Effort:** Small | **Risk:** None

---

### C3 — New Epic EA7: iamthelaw Module BMAD & API REST

**Artifact:** `epics.md` + `sprint-status.yaml`

**Epic:** EA7 — iamthelaw Module BMAD & API REST
**Sprint:** 12
**User Value:** "Les agents peuvent consulter et proposer des règles automatiquement. Je peux exporter/importer des règles entre projets. L'infrastructure de règles est indépendante et requêtable via API."

**Stories:**

| Story | Title | Description | Effort |
|-------|-------|-------------|--------|
| EA7-S1 | Enrich Rule model (level) | Add `level: MUST\|SHOULD\|MAY` to Rule interface, parse in IamTheLawLoader, default MUST if absent | Small |
| EA7-S2 | RulesApiHandler | API REST /api/rules — GET (list, filter by category/level/agent), GET /export, POST /proposals. Same pattern as StoriesApiHandler | Medium |
| EA7-S3 | Module BMAD — scaffold | Create iamthelaw module: module.yaml, README.md, standard BMAD structure | Small |
| EA7-S4 | Module BMAD — Agent Judge Dredd | Admin agent: menu list/export/import/audit rules. Reads iamthelaw/*.yaml directly | Medium |
| EA7-S5 | Module BMAD — Workflow retro-to-rules | Structured workflow to transform retro lessons into formal rules (used by SM) | Medium |
| EA7-S6 | Module BMAD — Workflow export/import | Export rules as portable YAML, import from another project or template | Small |
| EA7-S7 | Create initial rules R1-R5 | Populate iamthelaw/*.yaml with 5 rules from EA1 retro, activate sidecar sync | Small |

**Dependencies:**
- EA7-S1 ← none (backward compatible enrichment)
- EA7-S2 ← EA7-S1 (API exposes enriched model)
- EA7-S3 ← none (independent scaffold)
- EA7-S4 ← EA7-S3 (agent lives in module)
- EA7-S5 ← EA7-S3 (workflow lives in module)
- EA7-S6 ← EA7-S4 (export/import via Judge Dredd)
- EA7-S7 ← EA7-S1 (rules use enriched model)

**Definition of Done:**
- Module installable via BMAD installer in any project
- API REST /api/rules functional with filters (category, level, agent)
- Agent Judge Dredd operational with complete menu
- Workflow retro-to-rules usable by SM agent
- 5 initial rules active + sidecar synchronized
- Tests for RulesApiHandler and Rule model enrichment

**Effort:** Medium | **Risk:** Low

---

### C4 — Update EA4-S6 dependency on EA7

**Artifact:** `epics.md` — Epic EA4

```
Story: EA4-S6 — Retro-to-rules loop

OLD:
Sprint: 12
Dependencies: (none specified)
Description: Auto-generate rule proposals from retrospective findings

NEW:
Sprint: 14
Dependencies: EA7-S2 (API REST), EA7-S5 (workflow retro-to-rules)
Description: Connect retrospective output to rule creation pipeline.
  - SM agent invokes retro-to-rules workflow from module iamthelaw
  - Proposals submitted via POST /api/rules/proposals
  - cop1 RuleProposalService processes proposals
  - Human approval via Rule Approval UI
  - RuleApplicationService writes to iamthelaw/*.yaml
  - SidecarSyncListener triggers sidecar update
```

**Rationale:** EA4-S6 consumes the workflow and API produced by EA7. Sprint moved from 12 to 14 to respect the EA7 → EA4 sequence.

**Effort:** None (planning change) | **Risk:** None

---

### C5 — Sprint resequencing

**Artifact:** `sprint-status.yaml` + `epics.md`

```
OLD:
Sprint 10: EA2-S0/S0b/S0c, EA2-S3 to S5
Sprint 11: EA6 (Acceptance Test)
Sprint 12: EA3 (Dashboard)
Sprint 13: EA4 (Auto-Retro)

NEW:
Sprint 10: EA2-S0/S0b/S0c (done), EA2-S3 to S5 (budget)
Sprint 11: EA6 (Acceptance Test) — unchanged
Sprint 12: EA7 (iamthelaw Module & API) ← NEW
Sprint 13: EA3 (Dashboard)
Sprint 14: EA4 (Auto-Retro, with EA4-S6 connected to EA7)
```

**Rationale:** EA7 must be delivered before EA4 (EA4-S6 depends on EA7-S2 and EA7-S5). EA3 (Dashboard) is independent and can shift by one sprint. Total impact: +1 sprint.

**Effort:** None (planning change) | **Risk:** Low

---

## Section 5: Implementation Handoff

### Change Scope Classification

**Moderate** — New epic insertion, sprint resequencing, ADR update, and model enrichment. No fundamental replan required.

### Handoff

| Role | Responsibility |
|------|---------------|
| Architect (Winston) | Update ADR-010 with two-component architecture decision |
| SM (Bob) | Create EA7 stories via create-story workflow |
| Dev (Charlie) | Implement EA7-S1 (Rule model), EA7-S2 (RulesApiHandler), EA7-S7 (initial rules) |
| Module Builder (bmb) | Create module scaffold (EA7-S3), agent (EA7-S4), workflows (EA7-S5, EA7-S6) |
| PO (Alice) | Validate EA7 story scope at sprint planning |
| Project Lead (elzinko) | Final approval of module design and rule set |

### Artifacts to Update After Approval

| Artifact | Action | When |
|----------|--------|------|
| `sprint-status.yaml` | Add EA7 entries, update sprint comments for EA3/EA4 | Immediately |
| `epics.md` | Add Epic EA7 section, update EA4-S6 dependencies and sprint ordering | Immediately |
| `adr-010-*.md` | Update with two-component architecture decision | Before EA7 starts |
| `RuleSet.ts` | Add `level` to Rule interface | EA7-S1 |

### Success Criteria

- [ ] ADR-010 updated and approved
- [x] EA7 stories created and in backlog (sprint-status.yaml updated)
- [x] Sprint ordering reflects EA7 at Sprint 12
- [x] EA4-S6 dependency on EA7 documented
- [ ] Module BMAD iamthelaw installable and functional
- [ ] API REST /api/rules operational
- [ ] 5 initial rules active with sidecar sync

---

## Approval

- [x] Sprint Change Proposal reviewed by elzinko
- [x] All 5 change proposals approved individually (incremental mode)
- [x] Final approval: **YES** — 2026-03-11 by elzinko
- [x] sprint-status.yaml updated (EA2-S0c done, EA7 added, EA3/EA4 resequenced)

---

*Generated by Correct Course workflow — 2026-03-11*
*Reference: EA2-S0c consultation, ADR-010, epic-ea1-retro-2026-03-07.md*
