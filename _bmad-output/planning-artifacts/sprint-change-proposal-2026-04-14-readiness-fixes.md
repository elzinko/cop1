---
date: 2026-04-14
author: elzinko (with Claude as architect/PO)
trigger: implementation-readiness-report-2026-04-13.md
mode: batch
scope_classification: Major (replanning)
supersedes: none
related_scps:
  - sprint-change-proposal-2026-04-11-ea11-s8.md
related_adrs:
  - adr-013-orchestrator-sprintrunner-separation.md
  - adr-014-supervisor-tool-interface.md
decisions:
  - A: sync_prd_epics_fr_inventory
  - B: break_ea4_ea5_circular_dependency
  - C: reframe_ea11_user_value
  - D: map_nfr26_34_to_epics
deferred:
  - E: ux_specs_for_dashboard_gaps  # explicitly out of scope (no frontend work in V1-light; revisit post-CLI)
---

# Sprint Change Proposal — Readiness Fixes (2026-04-14)

## 1. Issue Summary

The **Implementation Readiness Report (2026-04-13)** assessed cop1 as **"NEEDS WORK"** and surfaced 4 critical issues that block safe implementation of EA10 and beyond:

1. **PRD ↔ Epics FR inventory divergence** — 28 FRs (FR88-FR116) exist only in epics with no PRD backing; 6 MVP-tagged FRs in the PRD have no epic story. Traceability is broken.
2. **Circular dependency EA4 ↔ EA5** — both epics list each other as prerequisite; neither can start.
3. **EA11 is a purely technical epic** — user value statement is "I need solid foundations", all 8 stories are architecture/housekeeping. Violates user-value-first principle.
4. **9 NFRs missing from epics** (NFR26-34) — non-functional requirements not tracked at epic level.

**Discovery context:** The readiness workflow was run 2026-04-13 during the Sprint 12 planning window, 2 days after SCP 2026-04-11 added EA11 as an orchestrator foundation epic. EA11 was created *in response to* the architect session flagged in that SCP — its technical-only framing is a known artefact, not a mistake.

**Evidence:** Rapport section "Critical Issues Requiring Immediate Action" (lignes 264-269). 28 orphan FRs listed in section "Coverage Matrix", 6 MVP gaps in section "Missing Requirements — Critical", circular dep documented in section "Critical Violations (RED)".

**Explicitly out of scope for this SCP:** UX/dashboard gaps (decision "E" in initial framing). Rationale: user strategy is "automate via CLI first, frontend later" — UI-only FRs (FR125, FR126, FR129, FR139) and UI-only NFRs (NFR26, NFR27) are **re-tagged Sprint 10+** rather than receiving UX specs now.

---

## 2. Impact Analysis

### 2.1 Epic Impact

| Epic | Current State | Impact of This SCP |
|---|---|---|
| **EA4** (Auto-Retro, 6 stories) | Blocked by circular dep | Dependency updated: EA5 stays upstream, EA4 becomes one-way consumer. Story count unchanged. |
| **EA5** (Sidecar Sync, 3 stories) | Blocked by circular dep | Dependency removed to EA4. EA5 becomes standalone (depends only on E9). Story count unchanged. |
| **EA11** (Orchestrator Foundation, 8 stories) | Technical-only framing | **Reframed** user value (transcript + committable history as user-visible artefact). S1/S2 absorbed into epic-level DoD. Story count remains 8 — no stories added/removed. |
| **EA10** (Supervisor, 9 stories) | Dependent on EA11 | Unchanged — still depends on completed EA11. Scope unchanged. |
| **E5** (LLM Infrastructure, 12 stories) | Oversized but in scope | **+1 story E5-S13** for FR121 (MCP audit logging). New story count: 13. |
| **E6** (LLM Provisioning, 4 stories) | Epic-only FRs (FR88-92) not in PRD | No epic change; PRD gains CA12 section mirroring existing epic scope. |
| **E10** (Quality Intelligence, 9 stories) | Epic-only FRs (FR93-101) not in PRD | No epic change; PRD gains CA13 section. |
| **E12** (Continuous Improvement, 8 stories) | Epic-only FRs (FR102-108) not in PRD | No epic change; PRD gains CA14 section. |
| Day-Sprint scope (FR109-115) | Epic-only, spread across multiple epics | PRD gains CA15 section; mapped to existing stories (see proposal §4.1.3). |

**No epic added. No epic deleted. Only EA11's user-value statement is rewritten, and E5 grows by one story.**

### 2.2 Story Impact

**New stories (2):**
- **E5-S13** MCP Audit Logging (FR121 + NFR28) — MVP backend, CLI-relevant
- **EA4-S7** (optional) Retro-to-rules event contract — clarifies the one-way consumption of EA5's sync event (absorbed into EA4-S6 if too small, see §4.2)

**Modified stories (0):** No existing story acceptance criteria or scope changed by this SCP. Only epic-level dependency graphs and user-value statements are edited.

**Re-tagged FRs (5):** FR125, FR126, FR129, FR135, FR139 move from MVP → Sprint 10+ in the PRD. The epics document already treats them as deferred/partial; this SCP aligns the PRD with that reality rather than forcing new stories.

### 2.3 Artifact Conflicts

| Artifact | Change Required |
|---|---|
| **PRD** (`prd.md`) | Add CA12/CA13/CA14/CA15 sections (FR88-FR116); re-tag 5 MVP FRs to Sprint 10+; add FR121 explicit sprint assignment; add NFR26-34 mapping to epics in NFR section |
| **Epics** (`epics.md`) | Fix EA5 dependency (remove EA4); rewrite EA11 user value + epic description; add E5-S13 story; add NFR mapping table at end of each affected epic |
| **UX brief** | **No change** (explicit deferral — user-driven, see §1) |
| **Architecture** | **No change** (ADR-013, ADR-014 are sufficient for the decisions in this SCP) |
| **sprint-status.yaml** | No change — current sprint (Sprint 12) stories untouched |

### 2.4 Technical Impact

- **No code changes** triggered by this SCP directly. It's a planning-artefact alignment.
- **Downstream code impact** once implemented: E5-S13 (MCP audit logger) introduces a new audit sink in `@cop1/observability`. Estimated Small-Medium, ~200-400 LOC.
- **Sequencing risk:** EA11 is mid-sprint (Sprint 12). The EA11 user-value rewrite should land *before* sprint retro to avoid retro basing its assessment on the obsolete user value. Low-effort edit (~15 lines in `epics.md`).

---

## 3. Recommended Approach

**Path chosen: Direct Adjustment with targeted PRD expansion.**

Alternatives considered and rejected:
- **Rollback EA11** — rejected. EA11 contains real dependencies for EA10 (per ADR-013 and ADR-014) and already has committed work (EA11-S4 ADR-013, EA11-S5 ADR-014 architect session). Rolling back wastes delivered work.
- **MVP review / scope reduction** — rejected. The 6 "missing MVP" FRs are dashboard features the user has explicitly deferred. Re-tagging (not removing) preserves traceability without changing commitments.
- **Full PRD rewrite to match epics** — rejected. Excessive churn. The epics are the source of truth for CA12-CA15 (they were derived from the Phase A pivot); the PRD simply needs an append-only update.

**Rationale:** All 4 issues are traceability / framing problems, not scope problems. No code has been built on a wrong assumption; no sprint is mid-execution on a broken spec. The fix is entirely artefact alignment + one new MVP story (FR121 MCP audit).

**Effort estimate:**
- PRD updates (add CA12-CA15, re-tag 5 FRs, add NFR mapping): ~2-3 hours (PM agent workflow)
- Epics updates (dep fix, EA11 rewrite, add E5-S13, NFR mapping): ~1-2 hours (PO agent workflow)
- E5-S13 story detailing (separate later): ~1 hour (SM/story-draft workflow)
- **Total:** ~4-6 hours of document work, 0 code impact

**Risk assessment:** LOW. All changes are additive or dependency-graph edits. No story currently in-progress is affected.

**Timeline impact:** ZERO on Sprint 12. Sprint 13 (EA10 execution) unblocked by this SCP since EA11's reframing is cosmetic to downstream contracts.

---

## 4. Detailed Change Proposals

### 4.1 Decision A — Sync PRD ↔ Epics FR Inventory

**Trance:** Bring the PRD up to the epics' inventory, then re-tag the 5 UI-only MVP FRs to Sprint 10+. Keep FR121 MVP and cover it with a new story.

#### 4.1.1 Add 28 orphan FRs to PRD (FR88-FR116)

These FRs already exist in `epics.md` with full descriptions. They represent 4 capability areas derived from the Phase A pivot (CA12-CA15). Add them to the PRD verbatim from epics, grouped:

**PRD — new section "CA12 — LLM Provisioning & Docker Management"**
- FR88 (Ollama/Docker provisioning via Web UI) — tag: **Phase 2** (Web UI deferred)
- FR89 (dynamic model download via ollama pull) — tag: **MVP Tier 1** (CLI-usable, already backend)
- FR90 (model status listing) — tag: **Phase 2** (Web UI)
- FR91 (ContainerRuntimePort + OllamaManagementPort decoupling) — tag: **MVP Tier 1** (architecture)
- FR92 (multi-provider registry) — tag: **MVP Tier 1** (1 active)

**PRD — new section "CA13 — Quality Intelligence"**
- FR93-FR101 — all tag **MVP Tier 2** except FR99 (Web UI) → **Phase 2**

**PRD — new section "CA14 — Continuous Improvement Review"**
- FR102-FR108 — tag **MVP Tier 2** for FR105-107 (backend persistence, RuleApplicationService); tag **Phase 2** for FR102, FR103, FR104, FR108 (Web UI / round-table UI)

**PRD — new section "CA15 — Day Sprint Mode & Time-Boxing"**
- FR109-FR116 — all tag **Phase 2** (Day Copilot phase) except FR116 (worktree execution mode) → **MVP Tier 1** (CLI, already implemented per E3-S15)

**Rationale:** Each FR gets a phase tag aligned with its channel (CLI/backend = MVP or Phase 1; Web UI = Phase 2). This preserves the MVP-first discipline while making the PRD inventory match reality.

#### 4.1.2 Re-tag 5 UI-only MVP FRs → Sprint 10+

| FR | Current PRD tag | New PRD tag | Justification |
|---|---|---|---|
| FR125 (SonarQube dashboard) | MVP (Sprint 8-9) | **Sprint 10+** | UI-only widget. Backend SonarQube integration already covered by E10. |
| FR126 (Pipeline view real-time) | MVP (Sprint 8-9) | **Sprint 10+** | UI-only. Backend event stream exists in E11. |
| FR129 (Sprint history navigation) | MVP (Sprint 8-9) | **Sprint 10+** | UI-only. File-based history (EA11-S8) covers the data layer. |
| FR135 (API REST backend) | MVP (Sprint 8-9) | **Sprint 10+** | Exists primarily to serve the dashboard. Ship when dashboard ships. |
| FR139 (Cold-start dashboard handling) | MVP (Sprint 8-9) | **Sprint 10+** | Pure UI UX concern. |

**Why together:** These 5 FRs are tightly coupled (dashboard bundle). Splitting them creates false granularity. Re-tagging as a bundle keeps them coherent and reopenable as a single "Observability Web UI" horizon when the user pivots back to frontend.

#### 4.1.3 Cover FR121 with new story E5-S13

**New story — E5-S13 "MCP Audit Logging"**
- **FR coverage:** FR121, NFR28
- **User value:** "As a Developer, every MCP call by any agent is recorded (agent id, tool, timestamp, arguments summary, result status) so I can audit agent behaviour and detect anomalies."
- **Package:** `@cop1/observability`
- **Size:** Small-Medium (~200-400 LOC + tests)
- **Sprint:** 7 or 8 (backend MVP — flexible per capacity)
- **DoD:**
  - Audit sink receives MCP invocation events from LLMGateway/MCPClient
  - JSONL output under `.cop1/audit/mcp-YYYY-MM-DD.jsonl` (gitignored)
  - Schema: `{ts, agent_id, tool_name, args_digest, result_status, duration_ms}`
  - Unit tests on serialization + rotation
  - CLI `cop1 audit mcp --since <date>` to dump recent entries (stretch, defer if over-capacity)

**Rationale:** FR121 is the ONE genuinely missing MVP backend requirement. NFR28 requires it. Creating one story is cheaper than suppressing the requirement.

---

### 4.2 Decision B — Break EA4 ↔ EA5 Circular Dependency

**Trance:** Make EA5 independent. EA4 remains one-way dependent on EA5.

**Change in `epics.md`:**

```diff
 ### Epic EA5 — BMAD Sidecar Sync
- Dependencies: E9 (iamthelaw rules), EA4 (retro-to-rules loop)
+ Dependencies: E9 (iamthelaw rules)

 ### Epic EA4 — Auto-Retro & Scrum Reconciliation
- Dependencies: EA1, EA5, E9, E12
+ Dependencies: EA1, EA5 (one-way consumer), E9, E12
```

**Design clarification (to add as note under EA5-S3):**

> EA5-S3 (Auto-sync on rule change) listens to EventBus for ANY rule change event — regardless of origin (manual edit, retro-derived proposal, CLI command). EA5 has no knowledge of the retro pipeline; it reacts to `rule.updated` events emitted by the rule persistence layer (E9's RuleApplicationService). EA4-S6 emits those events via RuleProposalService → RuleApplicationService → EventBus. EA5 consumes transparently.

**Rationale:** The circular reasoning was "EA5 must know about retro to sync retro-derived rules." False: EA5 must know about **rules changing**, which is an EventBus signal emitted by the rule layer. Retro just happens to be one producer among several. Removing EA4 from EA5's dep list makes the architecture cleaner *and* unblocks both epics.

**Validation:** Per agent analysis of EA4-S6 DoD ("Action items feed RuleProposalService → sidecar sync (EA5)"), the flow is already one-way in intent — the circular dep was a framing bug in the dependency list, not a design bug. Fix is mechanical.

**Optional new story EA4-S7 (deferred):** "Retro-to-rules event contract validation" — a small integration test ensuring EA4's retro output fires `rule.updated` events that EA5 consumes correctly. Can be absorbed into EA4-S6 DoD or kept separate. **Decision: absorb into EA4-S6 DoD** (add AC: "End-to-end test: retro output emits rule.updated event, EA5 sidecar reflects change within same tick").

---

### 4.3 Decision C — Reframe EA11 User Value

**Trance:** Keep EA11 as a distinct epic. Rewrite its user-value statement around the **user-visible artefact** (committable transcripts + history) that EA11-S7/S8 produce. Reclassify S1/S2 as epic-level housekeeping (not user-facing stories). No story added or removed.

#### 4.3.1 New EA11 framing

**Current (rejected):**
> "Before I can automate BMAD for 1 epic, I need foundations: dead code clearly deprecated, technical services cleanly extracted, architectural decisions documented, and readable transcripts of multi-turn sessions."

**New (proposed):**
> **Epic EA11 — Session Transcripts & Orchestrator Platform**
>
> **User value:** "As a Developer, after every multi-turn BMAD session I get a committable markdown transcript (Q/A, tool calls, decisions) and a per-story file-based history I can diff in git — so I can review what the orchestrator did without reading JSONL or log streams. This is the foundation that makes EA10 auditable and replayable."
>
> **Scope:** Delivers the 3-track persistence (exchange markdown, metrics JSONL, SDK session), the session transcript CLI (`cop1 transcript <session-id>`), plus the architectural primitives (extracted services, ADR-013/014, SupervisorContext) that EA10 consumes.
>
> **Housekeeping (epic-level DoD, not user-facing stories):**
> - Legacy cop1 agent classes marked `@deprecated` with rationale
> - `workflow.useBMAD=false` path emits runtime warning
>
> **Capacity note:** EA11-S1/S2 remain separately trackable as XS items for Sprint 12 planning but do not appear as user-facing stories in retros or stakeholder reports.

#### 4.3.2 What actually changes in `epics.md`

1. Rewrite the EA11 header (user value + scope description) — ~15 lines
2. Add a "Housekeeping" subsection immediately after the user-value block explaining S1/S2 are absorbed
3. Rename the epic title: "Orchestrator Foundation" → "Session Transcripts & Orchestrator Platform"
4. **No story deletion. No story renumbering.** S1-S8 keep their IDs and DoDs exactly as they are.

**Rationale:**
- EA11 produces two real user-visible artefacts: the `cop1 transcript` CLI output and the committable `.cop1/history/` markdown per story. Those are observable outcomes, not "foundations".
- Dissolving EA11 into EA10 would bloat EA10 to 17 stories (violating the readiness-report rule against oversized epics).
- Keeping the deprecation stories (S1/S2) in the story inventory but framing them as "housekeeping" (not "user value") respects the user-value-first principle without losing capacity bookkeeping.
- ADR-013 and ADR-014 are deliverables produced *during* EA11 stories (S4/S5) but their value is enabling EA10 — that enabling value is now made visible via the transcript artefact in the reframed user statement.

**Risk:** None. The reframe is pure documentation. All downstream dependencies (EA10 depending on EA11 completion) remain intact.

---

### 4.4 Decision D — Map NFR26-34 to Epics

**Trance:** Add NFRs to the epics NFR inventory; defer UI-only NFRs to Sprint 10+; add NFR28 to E5-S13; add NFR34 as cross-cutting DoD.

#### 4.4.1 NFR → Epic mapping table (to add to `epics.md` NFR section)

| NFR | Description | Assigned to | Phase |
|---|---|---|---|
| NFR26 | Sprint history load < 3s | EA3 (Dashboard) | **Sprint 10+** (UI) |
| NFR27 | KPI recalc < 2s | EA3 (Dashboard) | **Sprint 10+** (UI) |
| NFR28 | MCP audit logging | **E5-S13** (new) | **MVP** (backend) |
| NFR29 | Preview env cleanup | Preview env epic (not yet created) | **Sprint 10+** |
| NFR30 | DemoAgent timeout | Growth (DemoAgent) | **Growth** |
| NFR31 | Preview env startup < 30s | Preview env epic | **Sprint 10+** |
| NFR32 | DemoAgent abstraction | Growth (DemoAgent) | **Growth** |
| NFR33 | API REST response times | EA3 (APIs serve Dashboard) | **Sprint 10+** (UI bundle) |
| NFR34 | Test strategy per feature type | **Cross-cutting DoD** | **MVP** (now) |

#### 4.4.2 NFR34 as cross-cutting DoD (add to each epic's epic-level DoD)

> **Test strategy (NFR34):** Each story within this epic must meet the coverage threshold of its feature category: backend ≥80%, SSE/streaming ≥70%, UI ≥60%, preview env ≥50%. Deviation requires explicit waiver in story ACs.

**Rationale:** NFR34 isn't tied to any specific feature — it's a quality policy. Making it an epic-level DoD constraint (rather than a story) keeps it visible without inflating story count. Already partially enforced by E10-S* quality stories; the DoD mention makes it explicit for every epic.

---

### 4.5 Summary of Edit Proposals

| # | Artifact | Change Type | Size |
|---|---|---|---|
| 1 | `prd.md` | Add CA12-CA15 sections (28 FRs) | ~80 lines |
| 2 | `prd.md` | Re-tag FR125/126/129/135/139 MVP → Sprint 10+ | ~5 line edits |
| 3 | `prd.md` | Add FR121 Sprint assignment + NFR26-34 phase tags | ~10 line edits |
| 4 | `epics.md` | EA5 dependency fix (remove EA4) | ~2 line edits |
| 5 | `epics.md` | EA4 dependency clarification (one-way) + EA4-S6 DoD AC | ~4 line edits |
| 6 | `epics.md` | EA11 header + user-value rewrite + housekeeping subsection | ~25 line edits |
| 7 | `epics.md` | Add E5-S13 story (MCP audit) | ~30 lines |
| 8 | `epics.md` | Add NFR26-34 mapping table + NFR34 cross-cutting DoD | ~40 lines |

**Total:** ~200 lines of document edits, 0 code changes, 0 ACs altered on existing stories.

---

## 5. Implementation Handoff

### 5.1 Scope Classification

**Major.** Reason: touches the PRD (product-level doc), modifies epic dependency graph, creates a new story, and reframes an epic. Requires coordinated PM + PO + (optionally) Architect sign-off.

However, the change is **execution-risk-LOW**: no code, no story in-progress, no sprint disruption.

### 5.2 Routing & Sequencing

Execute in **strict order** — each step unblocks the next. All workflows are BMAD standard workflows.

| Step | Workflow | Owner | Inputs | Outputs | Blocks |
|---|---|---|---|---|---|
| **1** | `/bmad-bmm-correct-course` (this one) | User + Claude (architect/PO) | Readiness report 2026-04-13 | This SCP (approved) | Steps 2-6 |
| **2** | `/bmad-bmm-edit-prd` (or manual PM edit) | PM agent | This SCP §4.1, §4.4 | Updated `prd.md` with CA12-CA15, re-tags, NFR phases | Step 4 (epics sync) |
| **3** | `/bmad-bmm-edit-epics` (or manual PO edit) | PO agent | This SCP §4.2, §4.3, §4.4 | Updated `epics.md`: EA5/EA4 deps, EA11 reframe, E5-S13, NFR mapping | Step 5 (story detail) |
| **4** | `/bmad-bmm-validate-traceability` (if available; else re-run readiness) | PO agent | Updated PRD + epics | Traceability OK report | Step 6 |
| **5** | `/bmad-bmm-story-draft` for E5-S13 | SM agent | E5-S13 outline from this SCP | Detailed story file with ACs, test plan | Sprint 7/8 execution |
| **6** | `/bmad-bmm-check-implementation-readiness` (re-run) | Architect/PO | Updated docs | Clean readiness report (target: 0 critical issues) | EA10 implementation (Sprint 13) |

### 5.3 Deliverables

- ✅ **This SCP** (`sprint-change-proposal-2026-04-14-readiness-fixes.md`)
- ⏳ Updated PRD with CA12-CA15 + re-tagged FRs + NFR phases
- ⏳ Updated epics with dep fixes, EA11 reframe, E5-S13, NFR mapping
- ⏳ Detailed E5-S13 story file (SM workflow)
- ⏳ Clean readiness report re-run (target by 2026-04-16)

### 5.4 Success Criteria

1. Readiness workflow re-run after steps 2-5 reports **zero critical issues** (A-D resolved).
2. Remaining issues are only the explicitly-deferred UX gaps (decision "E" out of scope) and the minor/yellow items (naming convention, sprint ordering).
3. EA10 (Sprint 13) can start without circular-dep blockers or traceability warnings.
4. Sprint 12 in-progress stories untouched (no code disruption).

### 5.5 Explicit Deferrals (decision E and friends)

The following readiness-report findings are **acknowledged and deferred** rather than addressed:

- **UX specs for FR30, FR108, FR125, FR126, FR139** — revisit when the frontend horizon opens. Until then, these FRs stay tagged Sprint 10+ and have no UX obligation.
- **Oversized epics E3 (18 stories), E11 (13), E5 (13 after this SCP)** — splitting is a pure bookkeeping exercise. Defer until the next quarterly replan. Note: E5 grows by 1 story (S13) but the split recommendation from the readiness report is independent and remains open.
- **Technical stories disguised as user stories (E3-S16, E5-S9/10/11)** — same stance as EA11's S1/S2: acknowledge as housekeeping, don't rename now, revisit post-V1-light.
- **UX brief E16 → EA3 stale reference** — trivial fix, bundle with next UX workflow pass.
- **Minor issues (naming E vs EA, sprint-epic ordering)** — no action. Conventions are established, cost of renaming > benefit.

---

## 6. Approval

**Change trigger resolved:** 4 critical readiness issues
**Change scope:** Major (planning artefacts)
**Artefacts to modify:** `prd.md`, `epics.md`
**Handoff recipients:** PM agent (PRD), PO agent (epics), SM agent (E5-S13 story)
**Expected downstream unblock:** EA10 Sprint 13 implementation

**Awaiting user approval (yes/no/revise) to proceed with steps 2-6.**

---

## 7. Amendment 2026-04-14 — Copy-Paste-Ready Epic Patches

**Contexte :** L'agent d'édition PRD a écarté 3 items comme "hors scope de cette édition (SCP à traiter séparément)". Vérification faite : ces items sont déjà dans cette SCP (§4.1.3, §4.4.1, §4.4.2). Pas besoin d'une nouvelle SCP — ils relèvent de l'étape 3 du routing §5.2 (`edit-epics`). Cet amendement rend les patchs `epics.md` directement applicables pour lever toute ambiguïté de scope.

### 7.1 Statut des 3 items après édition PRD

| Item | Cible | Statut post-édition PRD |
|---|---|---|
| Re-tag FR125/126/129/135/139 MVP→Sprint 10+ (§4.1.2) | `prd.md` | ✅ **Appliqué** (prd.md L746-753) — aucun patch epics nécessaire |
| NFR26-34 phase tags (§4.4, volet PRD) | `prd.md` | ✅ **Appliqué** (prd.md L798-812) |
| NFR26-34 → epics mapping (§4.4.1) | `epics.md` | ❌ À appliquer — patch 7.3 ci-dessous |
| NFR34 cross-cutting DoD (§4.4.2) | `epics.md` | ❌ À appliquer — patch 7.4 ci-dessous |
| E5-S13 MCP Audit Logging (§4.1.3) | `epics.md` | ❌ À appliquer — patchs 7.2a + 7.2b ci-dessous |

### 7.2 Patch — Création story E5-S13

#### 7.2a — Summary bullet (Epic E5 story list)

**Cible :** `epics.md` — insérer après L552 (après `E5-S12`).

```markdown
- **E5-S13** : MCP Audit Logging — sink JSONL `.cop1/audit/mcp-YYYY-MM-DD.jsonl` recevant chaque invocation MCP via EventBus (agent_id, tool_name, args_digest, result_status, duration_ms) — CLI `cop1 audit mcp --since <date>` pour dump (FR121, NFR28)
```

Et mettre à jour la ligne `**FRs couvertes :**` (L533 environ) :

```diff
- **FRs couvertes :** FR13, FR14, FR15, FR16, FR17, FR47, FR49, FR52
+ **FRs couvertes :** FR13, FR14, FR15, FR16, FR17, FR47, FR49, FR52, FR121
```

#### 7.2b — Detailed story block (§ Stories Backlog Priorisé)

**Cible :** `epics.md` — insérer à la suite du dernier bloc E5 détaillé (après `#### [E5-S7]` L1824 ou dans le regroupement E5 du backlog priorisé — respecter l'ordre trouvé dans le fichier).

```markdown
---

#### [E5-S13] MCP Audit Logging
> **5 pts** | Must Have | Bloqué par : E5-S5, E7-S1

- **AC1** : `MCPAuditSink` souscrit à l'EventBus sur `mcp.call.completed` — chaque événement est écrit dans `.cop1/audit/mcp-YYYY-MM-DD.jsonl` avec schéma `{ts, agent_id, tool_name, args_digest, result_status, duration_ms}` (FR121, NFR28)
- **AC2** : `args_digest` est un hash SHA-256 tronqué (16 chars) des arguments — jamais les arguments en clair (NFR6 — pas de fuite de secrets potentiels dans les args MCP)
- **AC3** : Rotation quotidienne du fichier (`mcp-YYYY-MM-DD.jsonl`) — répertoire `.cop1/audit/` ajouté au `.gitignore` par le setup E1
- **AC4** : CLI `cop1 audit mcp --since <ISO-date>` retourne les entrées postérieures à la date, triées — stretch goal `--agent <id>` et `--tool <name>` pour filtrer
- **AC5** : Tests unitaires sur sérialisation, rotation de date, et digest ; test d'intégration avec EventBus mock émettant 100 événements → 100 lignes JSONL valides
```

**Note sprint assignment :** Sprint 7 ou 8 (MVP backend, flexible selon capacité). Non-bloquant pour EA10.

### 7.3 Patch — NFR26-34 inventory dans epics.md

**Cible :** `epics.md` — insérer avant `---` L232 (après la section "Maintainability (4)" NFR21-24, avant `### Additional Requirements (Architecture)`).

```markdown
**Phase 2 — Dashboard & Preview (ajoutés SCP 2026-04-14) (9)**
- NFR26 : Sprint history load < 3s → **EA3 Dashboard** — **Sprint 10+** (UI)
- NFR27 : KPI recalc < 2s → **EA3 Dashboard** — **Sprint 10+** (UI)
- NFR28 : MCP audit logging → **E5-S13** (nouveau) — **MVP** (backend)
- NFR29 : Preview env cleanup (pas de processus orphelin) → **Preview env epic** (à créer) — **Sprint 10+**
- NFR30 : DemoAgent timeout (5 min défaut) → **Growth (DemoAgent)** — **Growth**
- NFR31 : Preview env startup < 30s → **Preview env epic** — **Sprint 10+**
- NFR32 : DemoAgent abstraction derrière contrat métier → **Growth (DemoAgent)** — **Growth**
- NFR33 : API REST backend response times → **EA3 Dashboard** (bundle UI) — **Sprint 10+**
- NFR34 : Test strategy par feature type (voir §7.4) → **Cross-cutting DoD** — **MVP** (appliqué dès maintenant)
```

### 7.4 Patch — NFR34 cross-cutting DoD

**Cible :** `epics.md` — ajouter une note unique au niveau inventaire (évite de toucher les ~15 blocs DoD par epic). Insérer après le patch 7.3, avant `---` L232.

```markdown
**Note NFR34 (cross-cutting DoD) :** Chaque story de chaque epic doit satisfaire le seuil de couverture de sa catégorie de feature :
- Backend domain (hexagonal, services) : **≥ 80 %** (unit + integration via Vitest)
- SSE / EventBus / streaming : **≥ 70 %** (integration tests avec EventBus mock)
- Web UI : **≥ 60 %** (component tests React)
- Process management / preview env : **≥ 50 %** (integration tests avec timeout)

Déviation autorisée uniquement par waiver explicite dans les ACs de la story. Workflows BMAD TEA (`bmad_tea_automate`, `bmad_tea_test-review`, `bmad_tea_atdd`) utilisables pour générer et auditer les tests. Cette règle s'applique à toutes les epics sans besoin de réécrire chaque DoD individuellement.
```

### 7.5 Vérification post-application

Après application des patchs 7.2a/7.2b/7.3/7.4, `grep` sur `epics.md` doit retourner :
- `E5-S13` : ≥ 2 occurrences (summary + detailed block)
- `NFR26` à `NFR34` : ≥ 1 occurrence chacun
- `FR121` : ≥ 1 occurrence

Commande de contrôle :
```bash
grep -cE 'E5-S13|NFR2[6-9]|NFR3[0-4]|FR121' _bmad-output/planning-artifacts/epics.md
```

Attendu : ≥ 12 matches. Si < 12, réexécuter l'édition.

### 7.6 Clarification routing §5.2

L'étape 3 du routing (`/bmad-bmm-edit-epics`) reste en charge d'appliquer :
- Patchs §4.2 (EA5/EA4 deps), §4.3 (EA11 reframe) — inchangés
- Patchs 7.2a, 7.2b, 7.3, 7.4 — **remplacent** les descriptions prose de §4.1.3, §4.4.1, §4.4.2 qui étaient non-applicables directement

Aucune autre SCP n'est à créer pour ces items.

