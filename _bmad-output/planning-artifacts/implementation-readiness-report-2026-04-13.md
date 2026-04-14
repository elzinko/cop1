---
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
documents:
  prd: prd.md
  architecture: architecture.md
  epics: epics.md
  ux: ux-design-brief.md
---

# Implementation Readiness Assessment Report

**Date:** 2026-04-13
**Project:** cop1

## Document Inventory

| Document Type | File | Format |
|---|---|---|
| PRD | prd.md | Whole |
| Architecture | architecture.md | Whole |
| Epics & Stories | epics.md | Whole |
| UX Design | ux-design-brief.md | Whole |

**Duplicates:** None
**Missing Documents:** None

## PRD Analysis

### Functional Requirements (110 FRs)

| CA | Area | FRs | Count |
|---|---|---|---|
| CA1 | Backlog Management | FR1-5, FR63-69, FR71, FR80 | 14 |
| CA2 | Agent Orchestration | FR6-12, FR41-44, FR49, FR83-84, FR116-123, FR140-141 | 24 |
| CA3 | LLM Infrastructure | FR13-17, FR47, FR52, FR52b, FR120-121 | 8 |
| CA4 | Resource Management | FR18-21 | 4 |
| CA5 | Code Production & Git | FR22-26, FR48, FR137-138 | 8 |
| CA6 | Monitoring & Reporting | FR27-31, FR53, FR55, FR58, FR70, FR125-126, FR129, FR135, FR139 | 14 |
| CA7 | Agile Ceremony Engine | FR45-46, FR50-51, FR54, FR79, FR81-82, FR85-87 | 11 |
| CA8 | Configuration & Rules Engine | FR32-35, FR56-57, FR59-62 | 10 |
| CA9 | BMAD Interface & Story Versioning | FR72-78 | 7 |
| CA10 | Developer Control | FR36-40, FR142-144 | 8 |
| CA12 | Demo Agent & Visual Reporting | FR130-131 | 2 |

### Non-Functional Requirements (33 NFRs)

| Category | NFRs | Count |
|---|---|---|
| Performance | NFR1-4 | 4 |
| Security & Privacy | NFR5-8, NFR28 | 5 |
| Reliability & Resilience | NFR9-12 | 4 |
| Resource Management | NFR13-16 | 4 |
| Observability | NFR17-20, NFR26-27, NFR33-34 | 8 |
| Maintainability | NFR21-24, NFR29-32 | 8 |

### Additional Requirements

- **Hardware constraints:** M3 Max 64GB, night/day RAM profiles
- **Usage phases:** Phase 1 Night (MVP), Phase 2 Day Copilot (post-MVP), Phase 3 Live Assist (future)
- **Required integrations:** Ollama/LMStudio, Claude API, BMAD workflows, SonarQube, GitHub API (Growth), Telegram (Growth), Playwright MCP (Growth)
- **Dependency chain:** Sprint 7 is blocking prerequisite for Sprint 8+ features
- **Explicitly out of MVP:** Telegram, GitHub PR auto, parallel agents, /llm CLI, Plane.so, OpenClaw, Preview Env (Sprint 10+), DemoAgent (Growth), MCP Phase 2-3

### PRD Completeness Assessment

The PRD is comprehensive with 110 FRs across 11 capability areas and 33 NFRs. Requirements are well-structured with clear MVP scope (12 capabilities in 3 tiers), sprint roadmap with dependency chain, and explicit out-of-scope items. Growth/Phase markers are consistently applied.

## Epic Coverage Validation

### Coverage Matrix — Epics FR Coverage Map (FR1-FR116)

The epics document claims **116/116 FRs = 100%** coverage via its internal FR Coverage Map. This map covers FR1-FR116 across Epics E1-E12. Phase A epics (EA1-EA11) address post-pivot requirements.

### Critical Gap: PRD-Epics FR Inventory Divergence

**The PRD and Epics documents have divergent FR inventories.** This is the most significant finding.

#### FRs in PRD (FR117-FR144) NOT in Epics Coverage Map

| FR | Description | PRD Phase | Epic Coverage |
|---|---|---|---|
| FR117 | Preview env build guard | Sprint 10+ | No story |
| FR118 | Preview env cleanup | Sprint 10+ | No story |
| FR119 | DemoAgent WorkflowStep | Growth | Acceptable deferral |
| FR120 | MCP per-agent config | Phase 2 | Acceptable deferral |
| FR121 | MCP audit logging | **MVP** | **MISSING — NFR28 also requires this** |
| FR122 | DevAgent URL preview | Sprint 10+ | No story |
| FR123 | ReviewerAgent browse preview | Growth | Acceptable deferral |
| FR125 | SonarQube in Quality Dashboard | **MVP** | Implicit in E10-S9 but unmapped |
| FR126 | Pipeline view real-time detailed | **MVP** | Partial in E11-S2 — missing per-step detail |
| FR129 | Sprint history navigation | **MVP** | **MISSING** |
| FR130 | DemoAgent Playwright | Growth | Acceptable deferral |
| FR131 | DemoAgent visual report | Growth | Acceptable deferral |
| FR135 | API REST backend endpoints | **MVP** | **MISSING** |
| FR137 | Prompt enrichment | Sprint 7 | Covered by E3-S17 |
| FR138 | BMAD #yolo experiment | Sprint 10+ | Acceptable deferral |
| FR139 | Cold-start dashboard handling | **MVP** | **MISSING** |
| FR140 | Health-check preview env | Sprint 10+ | Acceptable deferral |
| FR141 | Dynamic ports per worktree | Growth | Acceptable deferral |
| FR142 | Budget tracking per story | MVP | Covered by EA2-S1 |
| FR143 | Budget cap config | MVP | Covered by EA2-S2 |
| FR144 | Budget alert auto-pause | MVP | Covered by EA2-S3/S4 |
| FR52b | LLM ceremony exclusion | Growth | **MISSING from map** |

#### FRs in Epics but NOT in PRD (28 FRs)

| Epics CA | FRs | Count | Description |
|---|---|---|---|
| CA12 — LLM Provisioning | FR88-92 | 5 | Docker/Ollama management |
| CA13 — Quality Intelligence | FR93-101 | 9 | Coverage, static analysis, quality metrics |
| CA14 — Continuous Improvement | FR102-108 | 7 | Improvement review workflow |
| CA15 — Day Sprint Mode | FR109-115 | 7 | Time-boxing, burndown, co-presence |

These 28 FRs exist only in the epics document and have no PRD backing.

#### NFR Gap

PRD has **33 NFRs**, Epics list only **24 NFRs**. Missing from epics: NFR26 (sprint history load time), NFR27 (KPI recalc time), NFR28 (MCP audit), NFR29 (preview env cleanup), NFR30 (DemoAgent timeout), NFR31 (preview env startup), NFR32 (DemoAgent abstraction), NFR33 (API REST response times), NFR34 (test strategy per feature type).

### Missing Requirements — Critical

| Priority | FRs | Issue |
|---|---|---|
| **CRITICAL** | FR121 | MCP audit logging is MVP-tagged in PRD, required by NFR28, but has no epic story |
| **CRITICAL** | FR88-FR116 (28 FRs) | Exist in epics but have no PRD backing — requirements traceability broken |
| **HIGH** | FR125, FR126, FR129, FR135, FR139 | MVP-tagged PRD requirements with no explicit epic coverage |
| **HIGH** | NFR26-34 (9 NFRs) | Missing from epics NFR inventory |
| **MEDIUM** | FR117, FR118, FR122, FR140 | Sprint 10+ items with no epic stories created |

### Coverage Statistics

- **PRD FRs (FR1-FR144):** 110 total
- **FRs explicitly covered in epics:** 89 (FR1-FR116 minus FR88-FR116 which are epics-only, plus FR137, FR142-144 covered by EA stories)
- **FRs with acceptable deferral (Growth/Phase 2):** 10
- **FRs MISSING coverage (MVP):** 6 (FR121, FR125 partial, FR126 partial, FR129, FR135, FR139)
- **FRs with no stories yet (Sprint 10+):** 5 (FR117, FR118, FR122, FR140, FR52b)
- **Epics-only FRs (no PRD backing):** 28 (FR88-FR116)
- **Effective coverage of PRD MVP FRs:** ~89%

## UX Alignment Assessment

### UX Document Status

**Found:** `ux-design-brief.md` (dated 2026-02-22, updated for Phase A pivot)

The UX brief defines 6 dashboard views: Sprint Overview, Sprint Replay, Scrum Metrics, Budget View, Agent Performance, Ceremony Reports. Target epic referenced as E16 (now EA3).

### UX ↔ PRD Alignment

| UX View | PRD FRs Covered | Status |
|---|---|---|
| Sprint Overview | FR27, FR58, FR53 | Aligned |
| Sprint Replay | FR55, FR129 | Aligned |
| Scrum Metrics | FR53, FR70, FR115 | Aligned |
| Budget View | FR142-144, EA2 | Aligned |
| Agent Performance | FR58 (metrics per agent) | Aligned |
| Ceremony Reports | FR54 | Aligned |

### UX ↔ PRD Gaps

| PRD Requirement | Issue |
|---|---|
| **FR126 — Pipeline View** | PRD requires a real-time pipeline view (Dev → Reviewer → QA → PM) per story with per-step status, model, tokens, duration. **No corresponding UX view.** |
| **FR125 — SonarQube Dashboard** | PRD requires SonarQube integration display (code smells, bugs, quality gate). **Not in UX brief.** |
| **FR139 — Cold-Start Handling** | PRD specifies informative messages for first sprint/no SonarQube. **Not addressed in UX.** |
| **FR30 — Decision History** | PRD requires agent decision history per story via Web UI. **No dedicated UX view.** |
| **FR108 — Improvement History** | PRD requires improvement decisions history in Web UI. **Not in UX brief.** |

### UX ↔ Architecture Alignment

Architecture support for UX is **well aligned**: EventBus → SSE + REST + JSONL data flow matches the UX data architecture. React 18 + Vite + dark theme stack confirmed. Existing API routes documented. New API routes needed are clearly specified.

### Warnings

1. **Stale reference:** UX brief still references "E16 — Enhanced Dashboard" — should be updated to EA3
2. **5 PRD dashboard requirements have no UX specification** — these views need UX design before implementation
3. **Pipeline View (FR126) is a Tier 3 MVP capability** — its absence from UX is a significant gap

## Epic Quality Review

### Best Practices Compliance per Epic

| Epic | User Value | Independence | Stories | Dependencies | ACs Quality | Verdict |
|---|---|---|---|---|---|---|
| E1 Foundation | OK | Standalone | 6 OK | None | Good | PASS |
| E2 Backlog | OK | E1 only | 11 OK | Backward OK | Good | PASS |
| E3 Sprint Engine | OK | E1,E2,E5 | **18 — oversized** | Backward OK | Good | WARN |
| E4 Blocage | OK | E3 | 4 OK | Backward OK | Good | PASS |
| E5 LLM Infra | OK | E1 | **12 — large** | Backward OK | Good | WARN |
| E6 LLM Provisioning | OK | E5 | 4 OK | Backward OK | Good | PASS |
| E7 Resource Mgmt | OK | E1 | 5 OK | Backward OK | Good | PASS |
| E8 Ceremony Engine | OK | E3,E5 | 10 OK | Backward OK | Good | PASS |
| E9 Rules Engine | OK | E1 | 9 OK | Backward OK | Good | PASS |
| E10 Quality Intel | OK | E1,E3 | 9 OK | Backward OK | Good | PASS |
| E11 Monitoring | OK | E1,E3 | **13 — large** | Backward OK | Good | WARN |
| E12 Continuous Imp. | OK | E8,E9,E10,E11 | 8 OK | **4 deps — heavy** | Good | WARN |
| EA1 BMAD Command | OK | E3,E5 | 8 OK | Backward OK | Good | PASS |
| EA2 Budget | OK | EA1 | 6 OK | Backward OK | Good | PASS |
| EA3 Dashboard | OK | EA2,E11,E8 | 7 OK | Backward OK | Adequate | PASS |
| EA4 Auto-Retro | OK | EA1,**EA5**,E9,E12 | 6 OK | **CIRCULAR with EA5** | Adequate | **FAIL** |
| EA5 Sidecar Sync | OK | E9,**EA4** | 3 OK | **CIRCULAR with EA4** | Adequate | **FAIL** |
| EA6 Acceptance Test | OK | EA1 | 4 OK | Backward OK | Good | PASS |
| EA7 iamthelaw Module | OK | E9,EA5 | 7 OK | Backward OK | Adequate | PASS |
| EA8 Distribution | OK | EA6,EA1 | 5 OK | Backward OK | Adequate | PASS |
| EA9 Multi-Turn | OK | EA1 | 6 OK | Backward OK | Good | PASS |
| EA10 Supervisor | OK | EA11,EA9,EA6 | 9 OK | Backward OK | Good | PASS |
| EA11 Orchestrator Fdn | **TECHNICAL** | EA9 | 8 OK | Backward OK | Adequate | **FAIL** |

### Critical Violations (RED)

**1. Circular dependency: EA4 ↔ EA5**
- EA4 lists EA5 (sidecar sync for rules) as dependency
- EA5 lists EA4 (retro-to-rules loop) as dependency
- Neither can be implemented first. **Must break the cycle** — likely by making EA5 independent of EA4 (sidecar sync doesn't need retro to function)

**2. EA11 is a technical epic with no user-facing value**
- User value statement: "Before I can automate BMAD for 1 epic, I need solid foundations"
- All 8 stories are technical: deprecations, service extraction, ADR writing, logger refactoring
- Recommendation: merge into EA10 as prerequisite stories or reframe with user-facing value

**3. Technical stories disguised as user stories**
- E3-S16 "Wire Real Agents in SprintRunner" — pure wiring
- E5-S9 "LLMGateway Event Emission" — pure wiring
- E5-S10 "LoggerBridge LLM Event Tracking" — pure wiring
- E5-S11 "TokensPerSecMonitor Wiring" — pure wiring
- EA11-S1/S2 "Deprecate legacy classes" — housekeeping
- These should be sub-tasks of user-facing stories, not standalone stories

### Major Issues (ORANGE)

**4. Oversized epics**
- E3 (18 stories): Split into "Sprint Workflow" (orchestration, checkpoint, resume) + "Agent Pipeline" (DevAgent, Reviewer, PM, wiring)
- E11 (13 stories): Split into "Real-Time Monitoring" (SSE, dashboard) + "Reporting" (morning report, journal, KPIs)
- E5 (12 stories): Split into "LLM Gateway & Routing" + "LLM Observability & MCP"

**5. Heavy dependency chain on E12**
- E12 depends on E8 + E9 + E10 + E11 (4 epics) — late delivery risk
- Any delay in E8-E11 blocks E12 entirely

**6. Acceptance criteria quality degradation in later epics**
- EA6, EA7, EA8 rely on epic-level DoD without story-level ACs
- EA11 stories have descriptive DoD but no testable ACs per story

### Minor Concerns (YELLOW)

**7. Mixed naming convention** — E1-E12 vs EA1-EA11 creates confusion
**8. Sprint ordering contradicts epic independence** — sprints mix stories from multiple epics
**9. Not all stories have explicit FR traceability** — some EA stories don't map to specific FRs

## Summary and Recommendations

### Overall Readiness Status

**NEEDS WORK** — The project has strong foundations (comprehensive PRD, solid architecture, well-structured core epics) but critical gaps in requirements traceability and epic quality must be addressed before proceeding to implementation of the remaining epics.

### Critical Issues Requiring Immediate Action

| # | Issue | Category | Impact |
|---|---|---|---|
| 1 | **PRD-Epics FR inventory divergence** — 28 FRs exist only in epics (FR88-FR116) with no PRD backing; 6 MVP FRs in PRD have no epic coverage | Coverage | Requirements traceability broken — impossible to verify scope |
| 2 | **Circular dependency EA4 ↔ EA5** | Epic Quality | Implementation deadlock — neither epic can start |
| 3 | **EA11 is a purely technical epic** | Epic Quality | Violates user-value-first principle — risk of scope creep |
| 4 | **9 NFRs missing from epics** (NFR26-34) | Coverage | Non-functional requirements may be ignored during implementation |

### High Priority Issues

| # | Issue | Category | Impact |
|---|---|---|---|
| 5 | **5 PRD dashboard FRs without UX specs** (FR30, FR108, FR125, FR126, FR139) | UX Gap | Dashboard features will be implemented without design guidance |
| 6 | **Oversized epics** (E3: 18 stories, E11: 13, E5: 12) | Epic Quality | Hard to track progress, risk of scope creep |
| 7 | **Technical stories disguised as user stories** (6 wiring/deprecation stories) | Epic Quality | Inflate story count, don't deliver user value |
| 8 | **UX brief references obsolete E16** instead of EA3 | UX Gap | Potential confusion during implementation |

### Recommended Next Steps

1. **Synchronize PRD and Epics FR inventories** — Either add FR88-FR116 to the PRD (if they represent real requirements) or remove them from epics. Update the epics FR Coverage Map to include FR117-FR144.
2. **Break EA4 ↔ EA5 circular dependency** — Make EA5 (Sidecar Sync) independent of EA4 by removing the retro-to-rules loop dependency. The sidecar can sync rules without needing the retro pipeline.
3. **Reframe EA11** — Either merge EA11's technical stories into EA10 as prerequisite sub-tasks, or rewrite the user value to focus on the observable outcome (e.g., "I can see a readable transcript of every automated session").
4. **Add 6 missing MVP FRs to epics** — Create stories for FR121 (MCP audit logging), FR125 (SonarQube display), FR126 (pipeline view detailed), FR129 (sprint history), FR135 (API REST), FR139 (cold-start).
5. **Add NFR26-34 to epics NFR inventory** — Ensure non-functional requirements are tracked in epics.
6. **Design UX for missing dashboard views** — Run UX design for Pipeline View (FR126), SonarQube (FR125), Decision History (FR30, FR108), Cold-start (FR139).
7. **Split oversized epics** — E3 into Sprint Workflow + Agent Pipeline; E11 into Real-Time Monitoring + Reporting.
8. **Update UX brief** — Replace E16 references with EA3.

### Final Note

This assessment identified **19 issues** across **4 categories** (Coverage: 4, UX: 4, Epic Quality: 9, Minor: 2). The 4 critical issues must be addressed before proceeding with implementation of EA10+ epics. The existing implementation (Sprints 0-11) is largely unaffected as the FR divergence mainly impacts later epics.

**Assessor:** Implementation Readiness Workflow
**Date:** 2026-04-13
