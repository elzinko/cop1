# Sprint Change Proposal — 2026-03-16

**Date:** 2026-03-16
**Author:** elzinko + Claude Opus 4.6
**Status:** Proposed
**Trigger:** ADR-011 (Distribution, Installation & Autonomous Sprint Orchestration) + Brainstorming session 2026-03-11
**Workflow:** Correct Course

---

## Section 1: Issue Summary

### Problem Statement

cop1 has no mechanism for distribution to third-party projects, installation on target projects, or dogfooding (developing itself). The brainstorming session of 2026-03-11 and the resulting ADR-011 formalize a **two-component distribution model** (BMAD module `cop1-method` + CLI `@cop1/cli`) with worktree isolation and PR as the sole integration point.

This strategic evolution requires:
1. A new epic (EA8) covering V1 distribution capabilities
2. Reprioritization of the sprint backlog to reflect new priorities

### Context

- **Discovery:** Brainstorming session 2026-03-11 explored distribution, dogfooding, and orchestration using 4 techniques (Morphological Analysis, First Principles Thinking, Chaos Engineering, Decision Tree Mapping)
- **Formalization:** ADR-011 captures all decisions, passed adversarial review (13 findings, all addressed)
- **Consistency:** ADR-011 is consistent with ADR-007 (two-layer architecture) and ADR-010 (iamthelaw two-component pattern)

### Evidence

- ADR-011 validated that BMAD cannot spawn processes (verified in code and roadmap) — cop1 CLI is the imperative engine
- Worktree isolation + mandatory PR review provides complete safety for dogfooding
- V1 uses the existing proven pipeline (dev → review → QA) unchanged — no unnecessary complexity

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Status | Impact | Detail |
|------|--------|--------|--------|
| **EA8 (NEW)** | — | **New epic created** | Distribution & Dogfooding cop1 — 6 stories based on ADR-011 |
| **EA2** (Budget) | in-progress | **Minor** | S3-S5 continue Sprint 11, S6 deferred to Future |
| **EA6** (Acceptance Test) | backlog | **Reprioritized ↑** | Sprint 11-12, validates E2E pipeline before dogfooding |
| **EA7** (iamthelaw Module) | backlog | **Reprioritized ↑** | Sprint 12-13, DoD prerequisite |
| **EA3** (Dashboard) | backlog | **Reprioritized ↓** | Sprint 13 → Sprint 15 |
| **EA4** (Auto-Retro) | backlog | **Reprioritized ↓** | Sprint 14 → Sprint 16 |
| E10, E11, E12 | in-progress | **None** | Remaining backlog stories unaffected |

### Story Impact

- **New stories:** EA8-S1 through EA8-S6 (5 active V1 + 1 future)
- **Modified stories:** EA2-S6 deferred from Sprint 12 to Future
- **No stories deleted or invalidated**

### Artifact Conflicts

| Artifact | Impact | Action Required |
|----------|--------|----------------|
| **sprint-status.yaml** | Must update | Add EA8, reprioritize sprint assignments |
| **epics.md** | Must update | Add EA8 full definition with stories |
| **PRD** | No conflict | ADR-011 V1 is additive, no PRD change needed |
| **Architecture** | No conflict | ADR-011 validated by ADR-007, consistent |
| **UI/UX** | N/A | No UI/UX spec exists |

### Technical Impact

- **SprintRunner:** Add worktree → PR creation flow after sprint completion
- **DaemonService:** Add graceful shutdown with CheckpointService.save() on SIGTERM
- **New component:** Pre-flight checker (validates BMAD, cop1-method, claude CLI)
- **New component:** PR creator (via `gh` CLI)
- **New BMAD module:** `cop1-method` (config.yaml, module-help.csv, zero TypeScript)
- **No refactoring** of existing components (ClaudeCliAdapter, PipelineStepFactory unchanged)

---

## Section 3: Recommended Approach

### Selected Path: Direct Adjustment

The change is **additive** — a new epic plus reprioritization. No existing work is invalidated or rolled back. No MVP scope reduction needed.

### Rationale

1. **ADR-011 provides precise story definitions** — minimal ambiguity for implementation
2. **Existing components are reused** — SprintRunner, CheckpointService, ClaudeCliAdapter require no refactoring
3. **Dependencies are clear** — EA6 validates pipeline before EA8 uses it for PR creation; EA7 provides DoD before full dogfooding
4. **Risk is low** — architecture validated by adversarial review, pattern mirrors ADR-010 (iamthelaw)
5. **EA3/EA4 deferral has low cost** — dashboard and auto-retro are nice-to-have, not blocking

### Effort & Risk

| Dimension | Assessment |
|-----------|------------|
| **Effort** | Medium — 1 new epic (5 active stories), reprioritization of 4 epics |
| **Risk** | Low — well-defined stories, proven architecture patterns |
| **Timeline impact** | EA3/EA4 pushed ~2 sprints (Sprint 15-16 instead of 13-14) |

### Alternatives Considered

| Alternative | Verdict | Why Not |
|-------------|---------|---------|
| Rollback completed work | Not viable | No completed work conflicts with the change |
| MVP scope reduction | Not necessary | ADR-011 V1 is already minimal, supervisor deferred to V2 |

---

## Section 4: Detailed Change Proposals

### 4.1 New Epic: EA8 — Distribution & Dogfooding cop1

**Source:** ADR-011 — cop1 Distribution, Installation & Autonomous Sprint Orchestration
**Objective:** Enable cop1 installation on third-party projects and dogfooding on itself, via the two-component model (BMAD module cop1-method + CLI @cop1/cli) with worktree isolation and PR as sole integration point.

| Story | Title | Description | Effort | Sprint |
|-------|-------|-------------|--------|--------|
| EA8-S1 | Pre-flight checks | Verify BMAD, cop1-method, claude CLI at startup. Block with clear messages if absent. | Small | 13 |
| EA8-S2 | Worktree → PR creation flow | After sprint completion, create GitHub PR from worktree branch via `gh` CLI. | Medium | 13 |
| EA8-S3 | Module BMAD cop1-method scaffold | Create BMAD module: config.yaml, module-help.csv, standard structure. Zero TypeScript. | Small | 13 |
| EA8-S4 | Graceful shutdown + checkpoint | Improve DaemonService to call CheckpointService.save() before exit on SIGTERM/SIGINT. | Small | 14 |
| EA8-S5 | Mode step-by-step | --step-by-step flag in SprintRunner that pauses before each pipeline step for human validation. | Small | 14 |
| EA8-S6 | Supervisor agent (V2/Future) | Future epic — stateless BMAD supervisor agent for dynamic decisions between steps. | — | Future |

**Dependencies:**
- EA8-S2 depends on EA6 (acceptance test validates E2E pipeline before automatic PR)
- EA8-S4 uses existing CheckpointService (EA1/E3)
- EA8-S6 is out of scope for V1, marked Future

**ADR Reference:** ADR-011 sections 4 (distribution), 5 (installation), 6.1 (V1 pipeline), 7 (worktree isolation), 8 (dogfooding)

### 4.2 Sprint Reprioritization

| Sprint | Content | Rationale |
|--------|---------|-----------|
| **11** | EA2 finish (S3-S5) + EA6 start (S1-S2) | Complete budget epic, begin high-priority acceptance tests |
| **12** | EA6 finish (S3-S4) + EA7 start (S1-S3, S7) | Finish acceptance tests, begin iamthelaw module + initial rules |
| **13** | EA7 finish (S4-S6) + EA8 start (S1-S3) | Complete iamthelaw, begin distribution & dogfooding |
| **14** | EA8 finish (S4-S5) | Complete graceful shutdown + step-by-step mode |
| **15** | EA3 (Enhanced Dashboard) | Lower priority, deferred from Sprint 13 |
| **16** | EA4 (Auto-Retro & Scrum Reconciliation) | Lower priority, deferred from Sprint 14 |
| **Future** | EA2-S6 (Claude usage API), EA8-S6 (Supervisor V2) | Not critical for V1 |

### 4.3 Deferred Story

```
Story: EA2-S6 — Claude usage API adapter
Section: Sprint assignment

OLD:
EA2-S6: backlog    # Claude usage API adapter — Sprint 12

NEW:
EA2-S6: backlog    # Claude usage API adapter — Future (pas critique V1)

Rationale: Claude usage API is a nice-to-have for budget tracking precision.
Not needed for V1 single-project mode. Existing BudgetService token counting is sufficient.
```

### 4.4 EA3/EA4 Resequencing

```
Epic EA3: Sprint 13 → Sprint 15 (SCP 2026-03-16)
Epic EA4: Sprint 14 → Sprint 16 (SCP 2026-03-16)

Rationale: Distribution (EA8) and iamthelaw activation (EA7) are higher priority
than dashboard enhancements and auto-retro. EA3/EA4 remain valuable but non-blocking.
```

---

## Section 5: Implementation Handoff

### Change Scope: Minor to Moderate

The change is primarily **backlog reorganization** (reprioritization) plus one new well-defined epic. No fundamental replan required.

| Scope | Classification |
|-------|---------------|
| **New epic definition** | Minor — stories well-defined by ADR-011 |
| **Sprint reprioritization** | Moderate — affects 4 epics across 6 sprints |
| **Architecture impact** | Minor — additive components, no refactoring |

### Handoff Plan

| Recipient | Responsibility | Deliverables |
|-----------|---------------|--------------|
| **SM (Scrum Master agent)** | Update sprint-status.yaml, create EA8 story files when sprint starts | This SCP + approved edit proposals |
| **Dev team** | Implement EA8 stories per ADR-011 specifications | ADR-011 as technical reference |
| **PO (Product Owner)** | Validate reprioritization aligns with product goals | Sprint plan review |

### Success Criteria

- [ ] sprint-status.yaml updated with EA8 and reprioritized sprints
- [ ] epics.md updated with EA8 full definition
- [ ] EA8 stories implementable using ADR-011 as reference
- [ ] EA6 completed before EA8-S2 (pipeline validation before PR creation)
- [ ] EA7-S7 completed (initial rules exist) before full dogfooding

---

## References

- **ADR-011:** `_bmad-output/planning-artifacts/adr-011-cop1-distribution-and-autonomous-orchestration.md`
- **ADR-010:** `_bmad-output/planning-artifacts/adr-010-iamthelaw-integration-consultation.md`
- **ADR-007:** `_bmad-output/planning-artifacts/historical/adr-007-bmad-cop1-iamthelaw-integration.md`
- **Brainstorming:** `_bmad-output/brainstorming/brainstorming-session-2026-03-11.md`
- **Previous SCPs:** `sprint-change-proposal-2026-03-09.md`, `sprint-change-proposal-2026-03-11.md`
