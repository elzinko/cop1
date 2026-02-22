# Retrospective — Epics E1-E12 Global Review

**Date:** 2026-02-22
**Scope:** All epics E1-E12 (Sprints 0-7)
**Facilitator:** Bob (Scrum Master)
**Participants:** Alice (PO), Amelia (Dev), Quinn (QA), Winston (Architect), elzinko (Project Lead)

---

## Epic Summary

| Epic | Name | Stories | Status |
|------|------|---------|--------|
| E1 | Foundation & Project Init | 4/4 | Complete |
| E2 | Backlog Management & BMAD Interface | 11/11 | Complete |
| E3 | Sprint Engine Core | 14/14 | Complete |
| E4 | Blocage & Escalade | 4/4 | Complete |
| E5 | LLM Infrastructure & Routing | 7/7 | Complete |
| E6 | LLM Provisioning & Docker | 4/4 | Complete |
| E7 | Resource Management | 5/5 | Complete |
| E8 | Agile Ceremony Engine | 8/8 | Complete |
| E9 | Rules Engine & iamthelaw | 8/9 | E9-S5 backlog |
| E10 | Quality Intelligence | 8/9 | E10-S9 backlog |
| E11 | Monitoring, Reporting & Web UI | 11/12 | E11-S10 backlog |
| E12 | Continuous Improvement Review | 7/8 | E12-S6b backlog |

**Total: 102/106 stories done (96.2%)**

---

## Delivery Metrics

- Sprints executed: 8 (Sprint 0 through Sprint 7)
- Test progression: 0 -> 115 -> 169 -> 209 -> 305 -> 388 -> 439 -> 465+
- Average velocity: ~13 stories/sprint
- Peak velocity: Sprint 4 (28 stories), Sprint 5 (26 stories)
- Minimum velocity: Sprint 6 (4 stories — focused agent wiring)

---

## What Went Well

### 1. Hexagonal Architecture Proved Its Value
The ports/adapters pattern enabled two major adapter swaps (stubs -> LLM agents in Sprint 6, LLM agents -> BMAD commands in Sprint 8) without domain refactoring. The composition root (`SprintRunner.buildRealSteps()`) is the single wiring point.

### 2. Crash Safety Was Non-Negotiable from Sprint 1
Checkpoint system (E3-S3) with atomic YAML writes (`reserved -> transitioning -> transitioned -> started`) and resume capability (E3-S4). No data loss reported across all sprint executions.

### 3. Governance as Pipeline (E8 + E9 + E12)
Retrospective produces mandatory `ArchitectureRuleProposal` and `RefactoringStoryProposal` outputs. iamthelaw (E9) stores versioned YAML rules with audit log. Developer approval gate ensures human control. This is a closed-loop improvement system.

### 4. Adaptive Resource Management (E7)
Day/night budgets (`ram_budget_night_gb: 48`, `ram_budget_day_gb: 20`) allow same code on MacBook (day) and server (night). Suspension at 75% RAM threshold — no OOM crashes.

### 5. Event-Driven Observability (E11)
EventBus used consistently across all features. SprintFormatter displays LLM metrics inline: `[story] dev (model Xs Nt) ok`. Real-time SSE streaming to dashboard.

### 6. Change Proposal Process
3 documented sprint change proposals (2026-02-18, 19, 20) show explicit course correction. Not waterfall; the team adapted when architecture gaps were discovered.

### 7. Late Adapter Implementation Was a Hidden Advantage
The delayed agent wiring (Sprint 6) turned out to be a fortunate accident. By the time real adapters were needed, it became clear that BMAD's battle-tested workflows (dev-story, code-review, QA) were far superior to custom LLM prompts. The hexagonal architecture meant the naive LLM adapters could be replaced wholesale by BMAD command adapters without any domain refactoring. Had the adapters been implemented in detail early on, that investment would have been wasted.

---

## What Didn't Go Well

### 1. Agent Wiring Discovered Late (Sprint 6) — Mitigated by BMAD Pivot
Sprints 0-5 built independent infrastructure with stubs. Real LLM agent wiring (`LLMCodeGenerator`, `LLMReviewer`) only happened in Sprint 6 (E5-S8, E3-S16). Sprint change proposal 2026-02-18: "The real agents exist but are not wired."

**Retrospective assessment:** This delay was initially seen as a problem, but the BMAD pivot (EA1) made it a non-issue. The naive LLM adapters were never meant to be the long-term solution. BMAD provides complete, extensible workflows via B-Map Module Template and B-Map Builder for agents, workflows, and modules — far beyond what custom adapters could achieve.

### 2. Poor LLM Prompt Quality (Sprint 7)
DevAgent had a 14-line prompt template with no project context, no conventions, no structured AC parsing. Generated generic code instead of targeted TypeScript. Fixed in E3-S17 but late.

### 3. ReviewerAgent Still Weak
Reviewer prompt is `"Quality report for ${context.storyId}"` — 25 characters, no code diff, no story context. This is an "eyes-closed" review. Not fixed because BMAD pivot makes it obsolete.

### 4. PM Agent Was a Stub Until Sprint 7
PMAgentWorkflowStep was a no-op placeholder. E3-S18 wired heuristic AC matching (not LLM-backed). Informational only, not blocking.

### 5. LLM Observability Added Late (Sprint 6-7)
LLM event tracking (E5-S9 to S12), SprintFormatter display (E11-S13) — all Sprint 6-7. Without visibility, prompt quality issues went undiagnosed.

### 6. sprint-status.yaml Location Mismatch
The `sprint-status.yaml` file is stored in `.cop1/` (hardcoded in `YamlStatusStore`) while BMAD workflows expect it in `_bmad-output/implementation-artifacts/`. This dual architecture creates confusion: the file was manually created for cop1 runtime tracking, but BMAD's sprint-planning workflow generates it in a different location. This mismatch should be resolved — either align cop1's `YamlStatusStore` to use BMAD's expected path, or configure BMAD to read from `.cop1/`.

---

## Key Patterns

### Pattern 1: Architecture-First, Agent-Wiring Last
5 sprints of infrastructure with stubs, then focused wiring sprint. This is inherent to hexagonal architecture but delayed real-world validation.

### Pattern 2: Bimodal Velocity
Sprint 4-5 (26-28 stories) = breadth-first feature coverage. Sprint 6 (4 stories) = depth/wiring. Story count != value delivered.

### Pattern 3: Markdown-Centric Workflow
Everything is `.md` files — stories, snapshots, reports, ceremony outputs. Human-readable, diff-friendly, no schema migrations. Deliberate design choice (ADR-001).

### Pattern 4: Governance as Code
iamthelaw YAML rules with version history (`history.jsonl`), mandatory retrospective outputs, developer approval gate, auto-application via `RuleApplicationService`. Few systems achieve this level of governance automation.

---

## Lessons Learned

1. **Orchestration > Generation**: cop1 excels as an orchestrator (workflow, checkpoints, resources, ceremonies, governance). LLM prompting was a weakness. BMAD fills this gap.

2. **Hexagonal architecture pays off at pivot time**: Two adapter swaps (stubs -> LLM -> BMAD) without domain changes validates the architectural investment.

3. **Observability must be early, not late**: Late LLM tracking delayed prompt quality diagnosis. For Phase A, integrate budget tracking (EA2) from Sprint 9.

4. **Bimodal velocity is normal**: Don't confuse story count with value. Sprint 6's 4 stories (agent wiring) delivered more end-to-end value than Sprint 4's 28 stories.

5. **Governance-as-pipeline works**: E8+E9+E12 form a closed loop. This pattern should be preserved in the BMAD pivot.

6. **Stay within BMAD's extension framework**: BMAD provides native mechanisms for customization (customize.yaml, sidecar memory, Extension Modules via B-Map Builder). cop1 should leverage these rather than building parallel systems. The iamthelaw integration should use the sidecar pattern (validated by tech-writer sidecar) and eventually evolve into a BMM Extension Module (E19).

---

## BMAD Pivot Validation

This retrospective confirms the BMAD pivot (EA1-EA5) as the correct strategic decision:

| Aspect | cop1 Direct LLM | BMAD via Claude CLI |
|--------|-----------------|---------------------|
| DevAgent prompt | 14 lines, generic | 10-step workflow, battle-tested |
| Code review | 25 chars, blind | Adversarial checklist, 50+ checks |
| QA validation | Stub (600ms) | Structured QA workflow |
| PM validation | Heuristic AC matching | Semantic AC validation |
| Prompt quality | Weak, late-improved | Proven on 106 stories |
| Extensibility | Custom TypeScript adapters | B-Map Builder: custom agents, workflows, modules |

**Decision:** cop1 becomes a thin orchestration layer over BMAD. Infrastructure (EventBus, checkpoints, resources, governance) is retained. LLM adapters are replaced by `BMADCommandPort`.

---

## BMAD Builder Integration Analysis

Analysis of BMAD v6.0.0 customization mechanisms and cop1 integration strategy.

### Available BMAD Customization Mechanisms

| Mechanism | Location | cop1 Relevance |
|-----------|----------|---------------|
| **customize.yaml** | `_bmad/_config/agents/{module}-{agent}.customize.yaml` | Load iamthelaw rules via `critical_actions` |
| **Sidecar memory** | `_bmad/_memory/{agent}-sidecar/` | Persist LLM-friendly rules for BMAD agents |
| **Extension Module** | `src/modules/{code}/` with `module.yaml` | Future: package iamthelaw as BMM extension |
| **project-context.md** | `_bmad-output/project-context.md` | Rejected — overwrite risk from `generate-project-context` |
| **Module variables** | `module.yaml` variable definitions | Useful but not for evolving rules |

### Integration Strategy (validated against ADR-007)

**Phase 1 — Sidecar + customize.yaml (EA5, Sprint 9):**
- Sync `.cop1/rules/active-rules.yaml` to `_bmad/_memory/iamthelaw-sidecar/rules.md`
- Configure `critical_actions` in `bmm-dev.customize.yaml`, `bmm-qa.customize.yaml`, `bmm-sm.customize.yaml`
- Pattern validated by existing tech-writer sidecar at `_bmad/_memory/tech-writer-sidecar/documentation-standards.md`

**Phase 2 — Bidirectional validation (Sprint 12+):**
- BMAD interactive agents read rules from sidecar
- cop1 autonomous agents read rules from `.cop1/rules/`
- cop1 retrospective writes rules to both locations

**Phase 3 — BMM Extension Module (E19, Sprint 14+):**
- Package iamthelaw as Extension Module (`code: bmm`)
- Add "Judge" agent with `hasSidecar: true`
- Add rule-check workflow in BMM phase 4 sequence
- Distributable as npm package

### BMAD Limitations (confirmed)

- No plugin/event/hook system — cop1 cannot inject behavior inside a running BMAD workflow
- No programmatic API — agents are prompt-driven (markdown + XML)
- No real-time sync — files loaded at workflow start, not watched
- No cross-agent communication during sessions

---

## Action Items

### Process Improvements

| # | Action | Type | Owner | Deadline | Success Criteria |
|---|--------|------|-------|----------|-----------------|
| 1 | Complete BMAD pipeline (EA1-S4, S5, S7) | User Story | Dev | Sprint 9 | `cop1 sprint run` executes Dev+Review+QA via BMAD |
| 2 | Integrate budget tracking (EA2-S1, S2) | User Story | Architect | Sprint 9 | Every Claude CLI call tracked in tokens + cost |
| 3 | Wire SprintRunner to BMAD steps (EA1-S5) | User Story | Dev | Sprint 9 | `buildRealSteps()` uses BMADCommandStep |
| 4 | Sidecar sync BMAD (EA5-S1, S2, S3) | Enabler | Dev | Sprint 9 | iamthelaw rules visible to BMAD agents |

### Technical Debt

| # | Item | Priority | Type | Action |
|---|------|----------|------|--------|
| 1 | ReviewerAgent weak prompt | LOW | Tech Debt | Obsoleted by BMADReviewStep |
| 2 | QAAgent stub | LOW | Tech Debt | Replaced by BMADQAStep (EA1-S4) |
| 3 | 4 stories in backlog (E9-S5, E10-S9, E11-S10, E12-S6b) | MEDIUM | Backlog Grooming | Evaluate relevance post-pivot |
| 4 | sprint-status.yaml path mismatch (.cop1/ vs implementation-artifacts/) | MEDIUM | Tech Debt | Align cop1 YamlStatusStore with BMAD expected path |

### Preparation for Phase A

| # | Task | Type | Sprint | Note |
|---|------|------|--------|------|
| 1 | UX design with Sally | Spike / Discovery | Before Sprint 10 | Run /bmad-bmm-create-ux-design with existing brief |
| 2 | Unified backlog tracking for non-dev tasks | Future Epic | TBD | Currently no tracking for ideation/PM/UX tasks — gap identified |

---

## Sprint Execution Data (2026-02-20)

Sample story execution (E10-S9):
- Dev agent: mistral:7b, 762 chars prompt, 2059 chars response, 44.8s, 515 tokens
- Reviewer agent: mistral:7b, 25 chars prompt, 1776 chars response, 26.0s
- QA agent: 600ms stub
- PM agent: 100ms stub
- Total: ~71 seconds per story

---

## Next Steps

1. Execute Sprint 9 (EA1-S4, EA1-S5, EA1-S7, EA5, EA2-S1, EA2-S2)
2. Complete critical path: BMADQAStep, SprintRunner wiring, error handling
3. Run UX design session before Sprint 10
4. Begin EA3 (Dashboard) in Sprint 10
5. Review 4 backlog stories for post-pivot relevance
6. Resolve sprint-status.yaml path mismatch

---

## Retrospective Workflow Assessment

This retrospective used the BMAD retro workflow (`_bmad/bmm/workflows/4-implementation/retrospective/`). Observations for EA4 automation:

### What Works Well in the Workflow
- Party mode with named agents creates engaging dialogue
- 12-step structure is comprehensive (discovery, analysis, previous retro integration, next epic preview, discussion, action items, readiness, closure)
- WAIT directives for user interaction ensure collaboration
- Document output is well-structured

### What Needs Adaptation for cop1 EA4
- Workflow expects `sprint-status.yaml` in `implementation-artifacts/` — cop1 stores it in `.cop1/`
- Story files are in `planning-artifacts/stories/sprint-N/` not `implementation-artifacts/`
- Epic-centric scope may not match cop1's sprint-centric execution model
- Need to feed real sprint metrics (from `.cop1/sprint-log-*.jsonl`) as context
- Party mode dialogue is rich but verbose for automated retros — consider concise mode
- Template variables (`{{epic_number}}`, `{{done_stories}}`) need programmatic resolution

### Recommended EA4 Customizations
1. Sprint-centric scope (review last sprint, not epic)
2. Inject real metrics from sprint log JSONL
3. Auto-generate action items from sprint data (rejection count, blocage count, velocity delta)
4. Concise output mode for automated runs (skip party dialogue)
5. Feed retro output into `RuleProposalService` for automated rule evolution
