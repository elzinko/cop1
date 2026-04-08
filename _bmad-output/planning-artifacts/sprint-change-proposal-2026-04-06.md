# Sprint Change Proposal — 2026-04-06

**Date:** 2026-04-06
**Author:** elzinko + Claude Opus 4.6
**Status:** Approved
**Trigger:** Backlog coherence review pre-Sprint 11 + ADR-012 blocking discovery
**Workflow:** Correct Course

---

## Section 1: Issue Summary

### Problem Statement

A pre-Sprint 11 backlog review revealed three interrelated issues requiring a course correction:

1. **ADR-012 is BLOCKING for automation:** The current `ClaudeCliAdapter` uses `claude -p` (single-shot mode), but BMAD skills **do not work in headless mode** (confirmed in official docs and ADR-012 §2.3). BMAD workflows are interactive and require multi-turn conversation. Without implementing ADR-012 (Claude Agent SDK + LLM Supervisor), **no automated sprint can actually execute BMAD workflows correctly**.

2. **E10/E11/E12 are phantom "in-progress" epics:** Each has 1 remaining backlog story that depends on future epics (EA3/EA4/Phase B). They will not progress until Sprint 15+ and pollute the status dashboard.

3. **Reprioritization needed:** The user's goal is to reach a functional automated sprint as fast as possible. Budget alerts (EA2-S3/S4/S5) are not on the critical path; ADR-012 implementation and dogfooding (EA8) are.

### Context

- **Discovery:** Backlog review conducted 2026-04-05 via sprint-status workflow
- **sprint-status.yaml** is 27 days stale (generated 2026-03-09)
- **ADR-012** was written 2026-03-19 and approved but never translated into an epic with stories
- **Last development activity:** Sprint 10 (EA1-S8 integration test, 2026-03-09)

### Evidence

- ADR-012 §2.3: "Les slash commands ne fonctionnent PAS en mode headless" — documented, verified
- ADR-012 §2.4 item D8: "Le skill resolver est exclusif au mode interactif"
- E10-S9 comment: "deferred to Phase B", E11-S10: "verify coverage by EA3", E12-S6b: "verify coverage by EA4"
- EA1 retro action items (Team DoD, iamthelaw sidecar) are covered by EA7-S7 — no new stories needed

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Current Status | Impact | Detail |
|------|---------------|--------|--------|
| **EA9 (NEW)** | — | **New epic created** | ADR-012 Multi-Turn BMAD Interaction — 6 stories from ADR-012 §12 |
| **E10** | in-progress | **→ done** | E10-S9 (Quality Dashboard) explicitly deferred to Phase B |
| **E11** | in-progress | **→ done** | E11-S10 (Improvement History UI) folded into EA3 scope |
| **E12** | in-progress | **→ done** | E12-S6b (Team Debate Button) folded into EA4 scope |
| **EA2** | in-progress | **Deprioritized** | S3-S5 moved from Sprint 11 to Sprint 15. S6 remains Future. |
| **EA6** | backlog | **Unchanged** | Sprint 12 — validates pipeline after ADR-012 |
| **EA7** | backlog | **Partially moved** | S7 (initial rules) moved to Sprint 14, rest remains Sprint 15 |
| **EA8** | backlog | **Unchanged** | Sprint 13-14 — distribution & dogfooding |
| **EA3** | backlog | **Pushed** | Sprint 15 → Sprint 16 |
| **EA4** | backlog | **Pushed** | Sprint 16 → Sprint 17 |

### Story Impact

- **New stories:** EA9-S1 through EA9-S6 (from ADR-012 §12)
- **Moved stories:** EA2-S3/S4/S5 (Sprint 11 → 15), EA7-S7 (Sprint 12 → 14)
- **Closed orphans:** E10-S9 (Phase B), E11-S10 (→ EA3), E12-S6b (→ EA4)
- **No stories deleted**

### Artifact Conflicts

| Artifact | Impact | Action Required |
|----------|--------|----------------|
| **sprint-status.yaml** | Must update | Add EA9, close E10/E11/E12, update `generated` date |
| **epics.md** | Must update | Add EA9 full definition with stories |
| **PRD** | No conflict | ADR-012 V1 is additive, supports PRD automation goals |
| **Architecture** | No conflict | architecture.md already references ADR-012 (lastUpdated: 2026-03-19) |
| **UI/UX** | N/A | No impact |

### Technical Impact

- **New dependency:** `@anthropic-ai/claude-agent-sdk` added to `@cop1/sprint-core`
- **New components:** BMADSessionPort, SupervisorLLMPort, AgentSdkSessionAdapter, SupervisorService, BMADSessionStep, SessionLogger, ClaudeResumeSessionAdapter (fallback)
- **Modified components:** PipelineStepFactory (swap BMADCommandSteps → BMADSessionSteps), StoryContextBuilder (produce BMADSessionContext)
- **Replaced components:** BMADDevStoryStep, BMADReviewStep → BMADSessionStep (configured per command)
- **No refactoring** of SprintRunner, WorkflowEngine, or BMADCommandPort (preserved for single-shot uses)

---

## Section 3: Recommended Approach

### Selected Path: Direct Adjustment

The change is **additive** — one new epic (EA9) plus reprioritization. No existing work is invalidated or rolled back. No MVP scope reduction needed.

### Rationale

1. **ADR-012 provides precise story definitions** (§12) — 6 stories with clear dependencies, effort estimates, and interfaces already designed
2. **Existing hexagonal architecture supports the change** — new ports/adapters, no domain refactoring
3. **Critical path to dogfooding is clear:** EA9 (multi-turn) → EA6 (validate) → EA8 (distribute)
4. **Budget alerts (EA2-S3/S4/S5) are non-blocking** — cop1 functions without them, they're observability improvements
5. **E10/E11/E12 closure is cosmetic but important** — reduces cognitive load, reflects reality

### Alternatives Considered

| Alternative | Verdict | Why Not |
|-------------|---------|---------|
| Rollback completed work | Not viable | No completed work conflicts with the change |
| MVP scope reduction | Not necessary | ADR-012 V1 is already minimal, fallback adapter available |
| Implement EA8 first without ADR-012 | Not viable | Without multi-turn, the pipeline can't execute BMAD workflows correctly |

---

## Section 4: Detailed Change Proposals

### 4.1 New Epic: EA9 — Multi-Turn BMAD Interaction (ADR-012)

**Source:** ADR-012 — Multi-Turn BMAD Interaction: Agent SDK + LLM Supervisor
**Objective:** Enable cop1 to execute BMAD workflows autonomously via multi-turn conversation, replacing the broken single-shot `claude -p` approach with the Claude Agent SDK.

| Story | Title | Description | Dependency | Effort | Sprint |
|-------|-------|-------------|------------|--------|--------|
| EA9-S1 | BMADSessionPort + AgentSdkSessionAdapter | Port interface + adapter with `startSession()` / `continueSession()` via Agent SDK. Config `settingSources`, `canUseTool` callback for `AskUserQuestion`. Unit tests with mock SDK. | None | Medium | 11 |
| EA9-S2 | SupervisorLLMPort + AgentSdkSupervisorAdapter | Port + adapter for the supervisor. Prompt engineering of supervisor prompt. Tests with simulated questions. | None | Medium | 11 |
| EA9-S3 | SupervisorService | Orchestrates responses: deterministic → LLM → escalation. Integrates session logging. | EA9-S1, EA9-S2 | Medium | 11 |
| EA9-S4 | BMADSessionStep | New WorkflowStep replacing BMADDevStoryStep/BMADReviewStep. Integrates BMADSessionPort + SupervisorService. | EA9-S3 | Medium | 11 |
| EA9-S5 | PipelineStepFactory migration | Replace BMADCommandStep instantiation with BMADSessionSteps. Composition root wiring. Integration test E2E. | EA9-S4 | Small | 11 |
| EA9-S6 | ClaudeResumeSessionAdapter (fallback) | Alternative adapter via `claude --resume` for cases where the SDK doesn't work. Manual workflow loading as prompts. | EA9-S1 (interface) | Small | 11 |

**Dependencies:**
- EA9-S1 and EA9-S2 can be developed in parallel
- EA9-S3 depends on both S1 and S2
- EA9-S4 depends on S3
- EA9-S5 depends on S4
- EA9-S6 only depends on the port interface (S1)
- External dependency: `@anthropic-ai/claude-agent-sdk` npm package

**Definition of Done:**
- `BMADSessionPort.startSession()` spawns an Agent SDK session with `settingSources: ["project"]` and `allowedTools: ["Skill", "Read", "Write", "Edit", "Bash", "Glob", "Grep"]`
- `canUseTool` callback intercepts `AskUserQuestion` calls and routes to `SupervisorService`
- `SupervisorService` handles 3 levels: deterministic answers, LLM-generated responses, developer escalation
- `BMADSessionStep` replaces `BMADDevStoryStep` and `BMADReviewStep` as a configurable step
- `PipelineStepFactory` instantiates `BMADSessionStep` when `useBMAD: true`
- All session interactions logged via `SessionLogger` to `.cop1/sprint-log-*.jsonl`
- `ClaudeResumeSessionAdapter` available as fallback via config flag
- Integration test: complete multi-turn session with a mock BMAD workflow

**ADR Reference:** ADR-012 (all sections)

### 4.2 Epic Closures

#### E10 — Quality Intelligence → done

```
Epic: epic-10
Status: in-progress → done

Rationale: 8/9 stories completed. E10-S9 (Quality Dashboard) explicitly deferred to Phase B.
E10-S9 status remains "backlog" for Phase B tracking.
```

#### E11 — Monitoring & Reporting → done

```
Epic: epic-11
Status: in-progress → done

Rationale: 12/13 stories completed. E11-S10 (Improvement Decisions History UI) scope
is subsumed by EA3 (Enhanced Dashboard). E11-S10 status remains "backlog" — to be
verified when EA3 is planned (Sprint 16).
```

#### E12 — Continuous Improvement Review → done

```
Epic: epic-12
Status: in-progress → done

Rationale: 8/9 stories completed. E12-S6b (Team Debate Button) scope is subsumed by
EA4 (Auto-Retro & Scrum Reconciliation). E12-S6b status remains "backlog" — to be
verified when EA4 is planned (Sprint 17).
```

### 4.3 Sprint Reprioritization

| Sprint | Content | Rationale |
|--------|---------|-----------|
| **11** | **EA9** (S1-S6) — Multi-Turn BMAD | BLOCKING — without this, no automated sprint works |
| **12** | **EA6** (S1-S4) — Acceptance Test Harness | Validate multi-turn pipeline works E2E before dogfooding |
| **13** | **EA8-S1/S2/S3** — Distribution start | Preflight, worktree→PR, module scaffold |
| **14** | **EA8-S4/S5** + **EA7-S7** | Graceful shutdown, step-by-step mode, initial iamthelaw rules |
| **15** | **EA7** (S1-S6) + **EA2** (S3-S5) | iamthelaw module complete + budget alerts |
| **16** | **EA3** (Enhanced Dashboard) | Dashboard enhancements |
| **17** | **EA4** (Auto-Retro & Scrum Reconciliation) | Automated retrospectives |
| **Future** | EA2-S6 (Claude usage API), EA8-S6 (Supervisor V2) | Unchanged |

**Key changes vs SCP 2026-03-16:**
- **New:** EA9 inserted at Sprint 11 as top priority
- **Moved:** EA2-S3/S4/S5 from Sprint 11 → Sprint 15
- **Moved:** EA3 from Sprint 15 → Sprint 16, EA4 from Sprint 16 → Sprint 17
- **Closed:** E10, E11, E12 marked done

---

## Section 5: Implementation Handoff

### Change Scope: Moderate

The change is primarily **backlog reorganization** (reprioritization + closures) plus one new well-defined epic with an existing ADR as full specification.

| Scope | Classification |
|-------|---------------|
| **New epic definition** | Minor — stories fully specified in ADR-012 §12 |
| **Sprint reprioritization** | Moderate — affects 6 epics across 7 sprints |
| **Epic closures** | Minor — cosmetic status updates |
| **Architecture impact** | Minor — additive components, ADR already approved |

### Handoff Plan

| Recipient | Responsibility | Deliverables |
|-----------|---------------|--------------|
| **SM (Scrum Master agent)** | Update sprint-status.yaml, create EA9 story files when sprint starts | This SCP + approved edit proposals |
| **Dev team** | Implement EA9 stories per ADR-012 specifications | ADR-012 as technical reference |
| **PO (Product Owner)** | Validate reprioritization aligns with "reach dogfooding ASAP" goal | Sprint plan review |

### Success Criteria

- [ ] sprint-status.yaml updated with EA9 entries and reprioritized sprints
- [ ] E10, E11, E12 marked "done" in sprint-status.yaml
- [ ] epics.md updated with EA9 full definition
- [ ] EA9 stories implementable using ADR-012 as reference
- [ ] Sprint 11 can start with EA9-S1 and EA9-S2 in parallel
- [ ] `generated` date in sprint-status.yaml updated to 2026-04-06

---

## References

- **ADR-012:** `_bmad-output/planning-artifacts/adr-012-multi-turn-bmad-interaction.md`
- **ADR-011:** `_bmad-output/planning-artifacts/adr-011-cop1-distribution-and-autonomous-orchestration.md`
- **Previous SCP:** `_bmad-output/planning-artifacts/sprint-change-proposal-2026-03-16.md`
- **EA1 Retrospective:** `_bmad-output/implementation-artifacts/epic-ea1-retro-2026-03-07.md`
