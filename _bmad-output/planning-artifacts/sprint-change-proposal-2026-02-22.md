# Sprint Change Proposal — BMAD Pivot (Phase A)

**Date:** 2026-02-22
**Author:** elzinko (Product Owner) + Claude (PM Agent / Correct Course Workflow)
**Status:** Approved (2026-02-22)
**Approved by:** elzinko
**Scope Classification:** Major — Replaces Phase 2+ epics E13-E20 with new EA1-EA5 structure
**Trigger:** Global Retrospective E1-E12 (Sprints 0-7)

---

## 1. Issue Summary

### Problem Statement

After completing Sprints 0-7 (Epics E1-E12, 102/106 stories done), a global retrospective revealed that **cop1 was replicating BMAD's battle-tested agent workflows** instead of orchestrating them. The planned Phase 2+ epics (E13-E20) would have built a PromptComposer, Agent Lab, LLM routing infrastructure, and custom agent prompts — capabilities that BMAD already provides with superior quality.

### Discovery Context

- cop1 DevAgent prompt: 14 lines vs BMAD dev-story: 10-step workflow with AC validation
- cop1 ReviewerAgent prompt: 25 characters vs BMAD code-review: adversarial checklist with 50+ checks
- cop1's hexagonal architecture (ports/adapters) makes the swap trivial: replace `LLMGateway` adapters with `BMADCommandPort` adapters

### Key Insight

**BMAD excels at defining WHAT each agent does** (dev-story 10-step, code-review checklist, QA validation).
**cop1 excels at controlling HOW agents are orchestrated** (scheduling, isolation, budget, governance).
They are complementary, not competing.

### Evidence

A BMAD Extension Module alone cannot replace cop1 because it runs in a single Claude Code session:
- Cannot launch each step in a separate prompt
- Cannot route to different models per agent
- Cannot track budget across steps
- Cannot checkpoint/resume between steps (crash = everything lost)
- Cannot timeout/retry per step
- Cannot enforce governance (iamthelaw rules, retro → proposals)

---

## 2. Impact Analysis

### Epic Impact

#### Disposition of Existing Phase 2+ Epics (E13-E20)

| Epic | Original Name | Decision | Rationale |
|------|--------------|----------|-----------|
| **E13** | Prompt Composer & BMAD Context Bridge | **Mostly obsolete** | BMAD handles prompt composition. Only sidecar sync (E13-S6, E13-S7) survives → moved to EA5 |
| **E14** | Token Budget & Cloud Escalade | **Elevated to EA2** | Budget tracking essential with cloud Claude usage. Simplified: focus on Claude API, not Ollama escalade |
| **E15** | Agent Lab & Scoring System | **Deferred to Phase B** | Requires local LLM first; not needed for BMAD orchestration |
| **E16** | Dashboard Enrichi & Sprint Replay | **Merged into EA3** | Enhanced with UX preview capability |
| **E17** | Workflow Scrum Complet | **Split** | DoR gate → EA4-S1, Auto-retro → EA4-S3, Pipeline config → Phase B |
| **E18** | Mode Interactif & Notifications | **Deferred to Phase B** | Nice-to-have, not critical for autonomous operation |
| **E19** | Module iamthelaw BMAD | **Deferred to Phase C** | Requires mature rule system |
| **E20** | CoachAgent | **Deferred to Phase C** | Requires scoring + retro data accumulation |

#### New Epic Structure — Phase A (EA1-EA5, Sprints 8-12)

| Epic | Name | Stories | Status |
|------|------|---------|--------|
| **EA1** | BMAD Command Orchestration | 8 | 4 done (Sprint 8 partial) |
| **EA2** | Budget & Consumption Tracking | 6 | Backlog |
| **EA3** | Enhanced Dashboard | 7 | Backlog |
| **EA4** | Auto-Retro & Scrum Reconciliation | 6 | Backlog |
| **EA5** | BMAD Sidecar Sync | 3 | Backlog |
| **Total** | | **30 stories** | |

#### Backlog Stories from E1-E12 (4 stories)

| Story | Decision | Rationale |
|-------|----------|-----------|
| **E9-S5** | Keep — replan Sprint 9 | iamthelaw rules feed EA5 Sidecar Sync |
| **E10-S9** | Defer to Phase B | Quality Intelligence replaced partially by BMAD code-review |
| **E11-S10** | Verify coverage by EA3 | Monitoring UI likely absorbed by EA3-S3/S4 |
| **E12-S6b** | Verify coverage by EA4 | Continuous improvement likely absorbed by EA4-S5/S6 |

### Artifact Conflicts

| Artifact | Conflict | Required Action | Priority |
|----------|----------|----------------|----------|
| **epics.md** | Missing EA1-EA5 | Add Phase A epics + pivot note + FR coverage map | HIGH |
| **epics-phase2-ideation.md** | Draft never integrated into official workflow | Archive to `historical/` | MEDIUM |
| **architecture.md** | No ADR for BMAD Execution Gateway | Add ADR-008, suspend ADR-005 (Ollama tiers) | HIGH |
| **prd.md** | MVP scope references Ollama/Docker as MVP | Update MVP capabilities #4 and #10, Integration Requirements | MEDIUM |
| **ux-design-brief.md** | Budget View references local vs cloud | Simplify to Claude API only, defer Agent Performance | LOW |
| **sprint-status.yaml** | Located at `.cop1/` instead of BMAD expected path | Migrate to `_bmad-output/implementation-artifacts/` | HIGH |
| **YamlStatusStore.ts** | Read-write store, cop1 manages transitions | Refactor to read-only `SprintStatusReader`, BMAD manages transitions | HIGH |

### Technical Impact

- **BMADCommandPort + ClaudeCliAdapter** — already implemented (Sprint 8, commit `4dbe595`)
- **Strategy pattern** — `LocalCliAdapter` now, `ContainerAdapter`/`RemoteAdapter`/`OllamaProxyAdapter` future
- **YamlStatusStore** — refactor to read-only, BMAD dev-story handles `ready-for-dev → in-progress → review` transitions
- **Existing E1-E12 code** — fully preserved and reused (WorkflowEngine, DORValidator, KPIsDashboardService, BurndownCalculator, VelocityProjector, RuleProposalService, ceremony-engine, web dashboard)

---

## 3. Recommended Approach

### Selected Path: New Structure (EA1-EA5) + Reduced MVP Scope

Replace E13-E20 with a clean EA1-EA5 structure. Update PRD to reflect BMAD-first approach. Preserve all E1-E12 code.

### Rationale

| Factor | Assessment |
|--------|-----------|
| Implementation effort | **Low** — brief already defines all stories, Sprint 8 partially done |
| Timeline impact | **Positive** — fewer components to build, BMAD does the heavy lifting |
| Technical risk | **Low** — hexagonal architecture makes the swap trivial |
| Quality impact | **Positive** — BMAD dev-story (10 steps + AC validation) > cop1 DevAgent (14-line prompt) |
| Team momentum | **Positive** — Sprint 8 already aligned with pivot direction |
| Long-term sustainability | **Good** — Strategy pattern allows future Docker/Ollama/Remote adapters |

### Alternatives Considered

1. **Refactor E13-E20 in-place** — Rejected: same effort as new structure, more confusing naming
2. **Rollback Sprint 8** — Rejected: code already aligned with pivot
3. **Keep LLM-direct approach** — Rejected: inferior quality proven by retro analysis

### Trade-offs

- **(+)** Quality: BMAD workflows battle-tested vs naive cop1 prompts
- **(+)** Simplicity: less code to maintain
- **(+)** Focus: cop1 does what it's good at (orchestration)
- **(-)** Dependency: cop1 depends on Claude Code CLI for execution
- **(-)** Expected velocity lower: BMAD workflows are more thorough but slower
- **(-)** No local LLM in Phase A: all execution goes through Claude API (cost)

---

## 4. Detailed Change Proposals

### Proposal 1: Update `epics.md` — APPROVED

Add EA1-EA5 epics as appendix to existing epics.md, with Phase A pivot note and updated FR coverage map. EA1-EA5 as defined in `phase-a-course-correction-brief.md`.

### Proposal 2: Archive `epics-phase2-ideation.md` — APPROVED

Move to `_bmad-output/planning-artifacts/historical/epics-phase2-ideation.md`. Draft document never integrated into official BMAD workflow. Archived for traceability.

### Proposal 3: Update `architecture.md` — ADR-008 Execution Gateway — APPROVED

Add ADR-008 documenting the cop1 Orchestrator / BMAD Executor pattern. Define `BMADCommandPort` interface with Strategy pattern (LocalCliAdapter → ContainerAdapter → RemoteAdapter → OllamaProxyAdapter). Suspend ADR-005 (LLM Routing & Access Tiers with Ollama) for Phase A.

### Proposal 4: Update `prd.md` — MVP Scope & LLM Infrastructure — APPROVED

Update MVP capabilities: replace "LLM Routing vers 2 LLMs minimum" with "BMAD Command Orchestration", replace "Docker LLM Stack" with "Claude API Budget Tracking". Move Ollama/LMStudio from MVP to Phase B in Integration Requirements. Add BMAD orchestration to Technical Success criteria.

### Proposal 5: Refactor `YamlStatusStore` → `SprintStatusReader` (read-only) — APPROVED

Change path from `.cop1/sprint-status.yaml` to `_bmad-output/implementation-artifacts/sprint-status.yaml`. Remove `write()` method — BMAD dev-story (Step 4 & 9) manages transitions. Update StoryStatusTracker, SprintRunner, CLI commands, DaemonService, and 3 test files.

### Proposal 6: Update `ux-design-brief.md` — Budget View — APPROVED

Simplify Budget View: remove local vs cloud distinction (Phase A is 100% Claude API), show per-BMAD-command consumption breakdown. Defer Agent Performance scoring to Phase B, show basic BMAD command output metrics instead.

### Proposal 7: Evaluate 4 backlog stories from E1-E12 — APPROVED

- E9-S5: Keep, replan with EA5 (Sprint 9)
- E10-S9: Defer to Phase B
- E11-S10: Verify coverage by EA3, close if duplicate
- E12-S6b: Verify coverage by EA4, close if duplicate

---

## 5. Implementation Handoff

### Scope Classification: Major

This is a fundamental replan requiring PM/Architect involvement.

### Handoff Plan

| Step | Role/Agent | Action | When |
|------|-----------|--------|------|
| 1 | **Product Owner** (elzinko) | Approve this Sprint Change Proposal | Now |
| 2 | **PM Agent** | Update `epics.md` with EA1-EA5 + pivot note | After approval |
| 3 | **PM Agent** | Archive `epics-phase2-ideation.md` to `historical/` | After approval |
| 4 | **Architect** (Winston) | Write ADR-008 in `architecture.md`, suspend ADR-005 | After approval |
| 5 | **PM Agent** | Update `prd.md` MVP scope and integration requirements | After approval |
| 6 | **PM Agent** | Update `ux-design-brief.md` Budget View section | After approval |
| 7 | **SM / Sprint Planning** | Run `/bmad-bmm-sprint-planning` to generate new sprint-status.yaml at `_bmad-output/implementation-artifacts/` with EA1-EA5 | After epics.md updated |
| 8 | **Dev** (Barry) | Refactor YamlStatusStore → SprintStatusReader (read-only) | Sprint 9 |
| 9 | **Dev** (Barry) | Complete EA1-S4, S5, S7, S8 (Sprint 8 remaining) | Sprint 8-9 |
| 10 | **UX** (Sally) | Run `/bmad-bmm-create-ux-design` before Sprint 10 (Dashboard) | Before Sprint 10 |

### Success Criteria

- [ ] All 7 change proposals implemented in planning artifacts
- [ ] sprint-status.yaml regenerated at BMAD expected path with EA1-EA5
- [ ] `cop1 sprint run` executes BMAD dev-story on a real story (EA1-S8 integration test)
- [ ] SprintStatusReader reads from BMAD path successfully
- [ ] Phase A Sprint 12 completes autonomous sprint-to-retro loop

### Dependencies

```
Proposal 1 (epics.md) ──→ Step 7 (sprint planning) ──→ Step 9 (dev)
Proposal 3 (ADR-008)  ──→ Step 9 (dev references architecture)
Proposal 5 (StatusReader) ──→ Step 9 (dev, Sprint 9)
Proposal 4 (PRD) ──→ independent
Proposal 6 (UX brief) ──→ Step 10 (Sally, before Sprint 10)
```

---

## 6. Sprint Ordering (Phase A)

### Sprint 8 — BMAD Command Foundation (PARTIALLY DONE)

**Done:** EA1-S1, EA1-S2, EA1-S3, EA1-S6 (commit `4dbe595`)
**Remaining:** Story files to be created via sprint planning

### Sprint 9 — Full BMAD Pipeline + Sidecar + Budget Start

- EA1-S4 (BMADQAStep)
- EA1-S5 (SprintRunner wiring)
- EA1-S7 (Error handling & retry)
- EA5-S1, EA5-S2, EA5-S3 (Sidecar sync)
- EA2-S1, EA2-S2 (TokenBudgetService + config)
- E9-S5 (iamthelaw rules — backlog story)
- YamlStatusStore → SprintStatusReader refactoring

### Sprint 10 — Budget Enforcement + Dashboard Start

- EA2-S3, EA2-S4, EA2-S5 (Alerts + pre-call check + CLI)
- EA1-S8 (Integration test)
- EA3-S1, EA3-S2 (Sprint Replay Engine + UI)
- **Prerequisite:** UX design with Sally before this sprint

### Sprint 11 — Dashboard Complete

- EA3-S3, EA3-S4, EA3-S5, EA3-S6 (Overview + Scrum Metrics + Budget View + Ceremonies)
- EA3-S7 (UX Preview)
- EA4-S1 (DoR Gate)

### Sprint 12 — Auto-Retro & Scrum Loop

- EA4-S2, EA4-S3, EA4-S4, EA4-S5, EA4-S6 (Smart abandonment + BMAD retro + rules loop)
- EA2-S6 (Claude usage API)

**Goal:** Autonomous sprint-to-retro loop, closed improvement cycle.
