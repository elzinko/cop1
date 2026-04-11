# Sprint Change Proposal — 2026-04-11

**Author**: elzinko (via Correct Course workflow)
**Date**: 2026-04-11
**Status**: Draft — pending approval
**Related**: ADR-012, SCP 2026-04-06, SCP 2026-04-07, EA9 retrospective 2026-04-08

---

## Section 1 — Issue Summary

### Problem statement

Post EA9 delivery (multi-turn BMAD interaction, Sprint 11), a gap assessment was performed to verify the backlog is aligned with the user's stated objective:

> "Create an agent manager that automates BMAD process interactions, so I can quickly launch a test on a single epic in a worktree, replay the history of exchanges (questions / answers and information), and drive the loop in step-by-step mode."

The verification revealed that while the core architectural direction (ADR-012 session layer, EA10 orchestration layer) is sound, **three capabilities critical to the stated objective are missing from the current backlog**:

1. No story enriches `SupervisorContext` with project data (PRD, architecture, project rules). The type is defined but populated with empty strings at runtime.
2. No story produces a human-readable transcript of multi-turn BMAD sessions. JSONL logs exist but are machine-oriented.
3. No ADR formalizes how the supervisor invokes technical services (worktree, checkpoint, history) — ADR-013 (Orchestrator vs SprintRunner) is referenced but unwritten, and a new ADR-014 is needed to define the "supervisor tool interface".

Additionally, a code audit revealed that the existing hardcoded-pipeline agent classes (DevAgent, ReviewerAgent, QAAgent, PMAgent + their *Step wrappers) are now vestigial under the BMAD-driven paradigm but have not been officially deprecated, creating ambiguity and maintenance burden.

### Discovery context

- Triggered by the user during a correct-course session on 2026-04-11
- Reinforced by the EA9 retrospective (2026-04-08) which explicitly flagged `SupervisorContext` enrichment as HIGH priority technical debt blocking EA10-S3
- Confirmed by a code audit of `SprintRunner`, `PipelineStepFactory`, the four agent classes, and `SupervisorService`

### Evidence

- **EA9 retro** (`_bmad-output/implementation-artifacts/epic-ea9-retro-2026-04-08.md`): "SupervisorContext enrichment is stubbed to empty strings — the LLM supervisor currently lacks project context, architecture rules, and iamthelaw rules for decision-making."
- **Code audit of `SupervisorService.ts`**: the fallback context builder (lines 190–199) hardcodes empty strings for `storyContent`, `projectContext`, `architectureRules`, `iamtheLawRules`.
- **Code audit of `SupervisorService.ts`**: no port, no method, and no state machine allow calling external agents for advice. The decision cascade is deterministic → LLM → terminal escalation.
- **Code audit of cop1 agent classes**: DevAgent (67 lines), ReviewerAgent (53 lines), QAAgent (65 lines), PMAgent (79 lines, no callers), and their *Step wrappers are all active in the legacy path but bypassed in BMAD mode.
- **Gap analysis of `epics.md`**: no story covers session transcript generation; `EA3-S2` (replay UI) is event-timeline, not conversation-form.

---

## Section 2 — Impact Analysis

### Epic impact

| Epic | Status | Impact | Detail |
|---|---|---|---|
| EA9 | DONE | None | Foundation is correct, no modification needed |
| EA6 (Sprint 12) | BACKLOG | None | Acceptance harness independent from the change |
| EA10 (Sprint 13) | BACKLOG | **Scope expanded** | 6 → 9 stories, one story (S3) deferred post-MVP |
| EA8 (Sprint 14-15) | BACKLOG | None | Distribution stories unaffected |
| EA7 (Sprint 14-15) | BACKLOG | None | iamthelaw BMAD module unaffected |
| EA2 remaining | BACKLOG | None | Already deprioritized (SCP 2026-04-06) |
| EA3 (Sprint 16) | BACKLOG | Soft | New EA11-S7 transcript could feed EA3-S2 replay — optional dependency |
| EA4 (Sprint 17) | BACKLOG | None | Auto-retro unaffected, still post-MVP |

No epic is invalidated. No new epic is required. All new stories absorb into EA9 (follow-up), EA10 (scope expansion), or create a dedicated "CLEAN/ARCH/SUPER/OBS" group slotted into Sprint 12.

### Story impact

**New stories to add** (16 total), organized into one new epic + restructuring of EA10.

#### New Epic EA11 — Orchestrator Foundation (Sprint 12)

Parallelized with EA6 acceptance harness. Mission: prepare the plumbing for the orchestrator.

- **EA11-S1** — Deprecate DevAgent / ReviewerAgent / QAAgent / PMAgent + *Step stubs (`@deprecated` JSDoc + runtime warning). Legacy code preserved, not deleted.
- **EA11-S2** — Deprecate `config.workflow.useBMAD = false` legacy mode path. Runtime warning when flag set to false.
- **EA11-S3** — Extract technical services into dedicated classes: `WorktreeService`, `HistoryService` (wraps NarrativeLog), `StepByStepController`. Keeps existing `CheckpointService`. Prepares for tool exposition (dependency of ADR-014).
- **EA11-S4** — Write ADR-013 "Orchestrator vs SprintRunner separation". Straightforward separation doc based on existing code.
- **EA11-S5** — Architect session → produce ADR-014 "Supervisor Tool Interface". Answers Q1–Q6 (see §4.5). Blocks EA10-S4, S7, S8.
- **EA11-S6** — `SupervisorContext` bootstrap loader. Reads PRD, architecture doc, project metadata from filesystem at sprint start and injects them into supervisor sessions. iamthelaw field reserved and empty.
- **EA11-S7** — Session transcript generator. Converts `NarrativeLog` JSONL multi-turn events into human-readable markdown (`.cop1/transcripts/session-{id}.md`). Foundational observability capability needed before orchestrator validation.

#### EA10 restructured — Supervisor Orchestrator (Sprint 13)

Original scope (6 stories) expanded to 9 stories. Original EA10-S3 (advanced auto-decision policies) deferred to V1.1.

- **EA10-S1** — `SupervisorPlaybookLoader` markdown parser. **Unchanged.**
- **EA10-S2** — Playbook format specification + reference example. **NEW.** Required sections: BMAD version preamble, help command pointer, process sequence, epic/story restrictions, worktree hooks, step-by-step hooks, decision policy.
- **EA10-S3** — cop1 minimal playbook (drives one epic). **NEW.** The real markdown: create-story → dev-story → code-review in loop. No sprint-planning, no retro. *(Replaces original EA10-S3 "advanced auto-decision policies" which is deferred.)*
- **EA10-S4** — `OrchestratorService` main loop, scope limited to 1 epic. **Adapted** from original EA10-S2. Delegates to `SprintRunner` for each BMAD command per ADR-013.
- **EA10-S5** — Mode `--step-by-step` inter-command with pause/confirm. Adapted from original EA10-S4.
- **EA10-S6** — CLI `cop1 orchestrator run --epic <id>`. Adapted from original EA10-S5.
- **EA10-S7** — Multi-agent advisory capability for supervisor. **NEW.** Nature (MCP server / Agent SDK tools / sidecar) decided by ADR-014.
- **EA10-S8** — Supervisor multi-step resolution loop. **NEW.** Extends `SupervisorService`: deterministic → LLM → consult agents → synthesize → escalate.
- **EA10-S9** — End-to-end integration test on EA6 cobaye fixture. Adapted from original EA10-S6.

#### Deferred to V1.1
- **EA10-S3-deferred** (original) — Advanced auto-decision policies. Basic decisions covered by EA10-S8.

**Stories deferred post-MVP (V1.1)**:
- EA10-S3 original scope (advanced auto-decision policies — basic decisions covered by EA10-S8)
- EA4 entire epic (DoR gate, smart abandonment, auto-retro, retro-to-rules)
- EA2-S3/S4/S5 (budget alerts — already deprioritized)
- Sprint-planning ceremony in playbook
- Auto-retro in playbook
- iamthelaw rules injection into `SupervisorContext` (field reserved, will be populated by EA7 follow-up)
- EA3 Enhanced Dashboard remains at Sprint 16

### Artifact conflicts

**PRD** — 3 new functional requirements needed:
- **FR145**: Inter-command step-by-step mode (`--step-by-step`) for the orchestrator
- **FR146**: Intra-command step-by-step mode for the pipeline (internal to BMADSessionStep)
- **FR147**: Human-readable transcript of multi-turn BMAD sessions (markdown format)

PRD Capability Area CA2 (Agent Orchestration) must also be updated to mention `OrchestratorService` as the inter-command orchestration layer, distinct from `SprintRunner` (intra-command).

**Architecture document**:
- Reference ADR-013 (when written) for the Orchestrator/SprintRunner separation
- Reference ADR-014 (when written) for the Supervisor Tool Interface decision
- Extend `SupervisorContext` schema section with the enriched fields
- Add a component for the session transcript generator in the observability package

**UX specifications**: no impact for V1-light (CLI-first). Optional wireframe for transcript view can be added in EA3-S2 later.

**sprint-status.yaml**: must register the 15 new stories and the deprecation markers.

**epics.md**: must document the new Sprint 12 story group and the EA10 restructuring.

### Technical impact

- ~382 lines of code enter deprecation state (not deleted) — no breaking change
- New services extracted from existing code (EA11-S3) — internal refactor, no API change
- Two new ADRs to be written and approved before dependent stories start
- No infrastructure, deployment, CI, or monitoring changes required
- Test coverage: EA10-S8 and EA10-S4 require new integration tests; real Agent SDK spike (flagged in EA9 retro) should be included as Task 0 of EA10-S7

---

## Section 3 — Recommended Approach

### Selected path

**Hybrid — Direct Adjustment (Option 1) + MVP Review (Option 3)**

### Rationale

1. **Timeline & momentum**: EA10 remains on the critical path at Sprint 13, simply expanded. Sprint 12 absorbs foundation work in parallel with EA6, producing zero calendar drift on the V1 horizon.
2. **Technical risk reduction**: scoping the V1-light MVP to "one epic automated" removes two large unknowns (sprint-planning complexity, retro loop) and enables a genuine end-to-end test on the EA6 cobaye during Sprint 14.
3. **Decision quality**: forcing an architect session (EA11-S5 → ADR-014) before writing orchestrator code avoids the failure mode observed in EA9 retro (skipping the SDK spike led to a CRITICAL session-resume bug).
4. **User morale & feedback loop**: the user's stated need ("launch quickly, test one epic, replay history") is preserved as the central MVP criterion. Dogfooding becomes possible from Sprint 13-14.
5. **Sustainability**: extracting technical services (EA11-S3) produces reusable building blocks for V1.1 extensions (sprint-planning, retro) and V2 (multi-LLM supervisor).
6. **Evolvability**: the architecture must not lock cop1 into Claude. The supervisor LLM provider is already abstracted behind `SupervisorLLMPort`; ADR-014 must preserve that evolvability for local/remote LLMs.

### Trade-offs

- ✅ Accepted: "sprint complet automatisé" (with planning + retro) leaves MVP and enters V1.1
- ✅ Accepted: advanced auto-decision policies (EA10-S3 original scope) deferred — basic multi-step resolution covers V1-light
- ✅ Accepted: iamthelaw rules injection deferred to EA7 follow-up (field reserved in `SupervisorContext`)
- ⚠️ Non-negotiable: architect session BEFORE any orchestrator code, to avoid ADR-014 drift
- ⚠️ Non-negotiable: supervisor history treated as first-class observability data, same channel as agent/command history

### Effort & risk estimate

- **Effort**: Medium (~15 new stories, 2 ADRs, 3 deprecations, 1 PRD update)
- **Risk**: Medium — concentrated on ADR-014 quality. Mitigated by architect session + SDK spike (EA9 retro lesson)
- **Timeline impact**: 0 sprint drift (Sprint 12 parallelized with EA6)

---

## Section 4 — Detailed Change Proposals

### 4.1 — PRD edits

```
Section: Functional Requirements — Capability Area CA2 (Agent Orchestration)

ADD:
- FR145: The system SHALL support a `--step-by-step` inter-command mode
  where the orchestrator pauses and requires user confirmation before
  invoking each BMAD command in the playbook sequence.

- FR146: The system SHALL support an intra-command step-by-step mode
  where the pipeline pauses between internal steps of a single BMAD
  command (pre-execution, post-execution, post-review).

- FR147: The system SHALL generate a human-readable markdown transcript
  of each multi-turn BMAD session, including questions asked by BMAD,
  answers produced by the supervisor, and resulting state changes. The
  transcript SHALL be stored alongside the session logs and accessible
  via CLI (`cop1 transcript <session-id>`).

Rationale: user need for interactive validation during early dogfooding
and for post-hoc auditability of automated sprint executions.
```

### 4.2 — Architecture document edits

```
Section: Architecture Decisions

ADD REFERENCE:
- ADR-013: Orchestrator vs SprintRunner separation — to be produced
  during Sprint 12, prerequisite for EA10-S4.

- ADR-014: Supervisor Tool Interface — defines how the LLM supervisor
  invokes cop1 technical services (worktree, checkpoint, history,
  step-by-step control). Decision between MCP server, Agent SDK
  in-process tools, BMAD sidecar, or hybrid. Must be produced in an
  architect session during Sprint 12, prerequisite for EA10-S7 and
  EA10-S4. Open questions Q1–Q6 documented in EA11-S5 story.

Section: Components — sprint-core.bmad-orchestration

UPDATE:
- SupervisorContext: now populated at sprint bootstrap by EA11-S6
  loader. Fields `projectContext`, `architectureRules`, and project
  metadata are required. Field `iamtheLawRules` remains reserved and
  empty until EA7 follow-up.

- SupervisorService: extended with multi-step resolution loop (EA10-S8):
  deterministic → LLM → consult external agents → synthesize → escalate.
  External agent invocation mechanism defined by ADR-014.

Section: Components — observability

ADD:
- SessionTranscriptGenerator: new component that reads NarrativeLog
  JSONL events for a given session and produces a markdown transcript
  with conversation-form formatting. Consumer of existing NarrativeLogPort.
```

### 4.3 — Epics edits

```
Section: EA10 — Supervisor Orchestrator (Sprint 13)

UPDATE SCOPE: expanded from 6 to 9 stories, one original story deferred.

Stories:
- EA10-S1 (unchanged): SupervisorPlaybookLoader markdown parser
- EA10-S2 (NEW):       Playbook format specification + reference example
- EA10-S3 (REPLACED):  cop1 minimal playbook — original S3 "auto-decision
                       policies" DEFERRED to V1.1
- EA10-S4 (was S2):    OrchestratorService main loop — 1-epic scope
- EA10-S5 (was S4):    --step-by-step inter-command mode
- EA10-S6 (was S5):    CLI cop1 orchestrator run --epic <id>
- EA10-S7 (NEW):       Multi-agent advisory capability for supervisor
- EA10-S8 (NEW):       Supervisor multi-step resolution loop
- EA10-S9 (was S6):    E2E integration test on EA6 cobaye fixture

Section: NEW Epic EA11 — Orchestrator Foundation (Sprint 12)

ADD new epic, parallelized with EA6 in Sprint 12. Seven stories:

- EA11-S1: Deprecate legacy cop1 agent classes (DevAgent, ReviewerAgent,
           QAAgent, PMAgent + *Step wrappers)
- EA11-S2: Deprecate legacy workflow.useBMAD=false path
- EA11-S3: Extract technical services (WorktreeService, HistoryService,
           StepByStepController) into dedicated classes
- EA11-S4: Write ADR-013 "Orchestrator vs SprintRunner separation"
- EA11-S5: Architect session → produce ADR-014 "Supervisor Tool Interface"
- EA11-S6: SupervisorContext bootstrap loader
- EA11-S7: Session transcript generator
```

### 4.4 — sprint-status.yaml edits

```yaml
# New entries to add under development_status:

# --- Epic EA11 — Orchestrator Foundation (Sprint 12) ---
# Added 2026-04-11 — Sprint Change Proposal approved
# Parallelized with EA6 acceptance harness
epic-ea11: backlog
EA11-S1: backlog    # Deprecate legacy cop1 agents — Sprint 12
EA11-S2: backlog    # Deprecate workflow.useBMAD=false path — Sprint 12
EA11-S3: backlog    # Extract technical services — Sprint 12
EA11-S4: backlog    # ADR-013 Orchestrator vs SprintRunner — Sprint 12
EA11-S5: backlog    # ADR-014 Supervisor Tool Interface (architect session) — Sprint 12
EA11-S6: backlog    # SupervisorContext bootstrap loader — Sprint 12
EA11-S7: backlog    # Session transcript generator — Sprint 12
epic-ea11-retrospective: optional

# --- Epic EA10 — Supervisor Orchestrator (Sprint 13) — RESTRUCTURED ---
# Updated 2026-04-11 — Sprint Change Proposal approved
# Expanded from 6 to 9 stories, original S3 deferred to V1.1
# BLOCKING for V1-light DoD "automate 1 epic"
# Depends on: EA11 (all stories), EA9 (done), EA6 (for S9 integration test)
# epic-ea10: backlog (already exists in sprint-status.yaml)
EA10-S1: backlog    # SupervisorPlaybookLoader (unchanged)
EA10-S2: backlog    # NEW - Playbook format specification + example
EA10-S3: backlog    # NEW - cop1 minimal playbook (replaces deferred auto-decision policies)
EA10-S4: backlog    # OrchestratorService main loop, 1-epic scope (was original S2)
EA10-S5: backlog    # --step-by-step inter-command (was original S4)
EA10-S6: backlog    # CLI cop1 orchestrator run --epic <id> (was original S5)
EA10-S7: backlog    # NEW - Multi-agent advisory capability
EA10-S8: backlog    # NEW - Supervisor multi-step resolution loop
EA10-S9: backlog    # E2E integration test on EA6 cobaye (was original S6)

# --- Deferred to V1.1 ---
# EA10-S3-original (advanced auto-decision policies) — covered by EA10-S8 at V1-light
```

### 4.5 — Architect session brief for ADR-014

**Questions to answer in EA11-S5**:

- **Q1** — Bridge mechanism between LLM supervisor and cop1 services
  - Options: MCP server cop1 | Agent SDK in-process tools | BMAD sidecar file-based | Hybrid
- **Q2** — Access scope: supervisor-only or shared with BMAD internal agents?
  - If shared: commit-after-dev and similar flows become natural
  - If supervisor-only: simpler protocol, but supervisor is a choke point
- **Q3** — Supervisor LLM provider abstraction
  - Today: Claude Opus 4.6 (acceptable)
  - Tomorrow: local/remote LLM via `SupervisorLLMPort` (must be preserved, not bypassed)
- **Q4** — Code vs LLM frontier in the orchestration loop
  - Which decisions stay in TypeScript (retries, error classification, worktree lifecycle)?
  - Which are delegated to the LLM supervisor (command selection, advice synthesis, question answering)?
- **Q5** — Playbook format
  - Free markdown | markdown with required sections | BMAD workflow.xml-like | other
  - Must stay stable as BMAD evolves
- **Q6** — Supervisor history capture
  - Single NarrativeLog channel with dedicated event types | twin channel | Agent SDK native session logs augmented

---

## Section 5 — Implementation Handoff

### Scope classification

**Moderate** — requires backlog reorganization and coordinated changes across PRD, architecture doc, epics, and sprint-status, but no fundamental replan. Architect involvement is needed only for two focused ADRs.

### Handoff recipients

**Architect** (critical path)
- Deliverable: ADR-013 (Orchestrator vs SprintRunner) — straightforward separation doc
- Deliverable: ADR-014 (Supervisor Tool Interface) — architect session with user, answers Q1–Q6
- Timeline: Sprint 12, must complete before any EA10-S7 or EA10-S4 code starts
- Success criteria: both ADRs reviewed and approved by user before coding begins

**Product Manager / Scrum Master**
- Deliverable: register 16 new stories (7 in new EA11, 9 in restructured EA10) in `sprint-status.yaml` and `epics.md`
- Deliverable: update `prd.md` with FR145, FR146, FR147 and CA2 text
- Deliverable: mark EA10-S3 as deferred post-MVP
- Deliverable: ensure legacy mode deprecation is visible in epics.md
- Timeline: before Sprint 12 starts

**Development team**
- Sprint 12: EA11-S1/2/3, EA11-S6, plus EA11-S4 supporting work
- Sprint 13: EA10-S1/2/3/4/5/6, EA10-S7/3, EA11-S7 — blocked until EA11-S5 delivers
- Sprint 14: EA10-S9 (E2E test on EA6 cobaye)
- Success criteria: end of Sprint 14, `cop1 orchestrator run --epic <id>` runs successfully on a real epic with step-by-step mode and produces a readable transcript

**User (elzinko)**
- Participate in architect session for ADR-014
- Validate playbook format decision (Q5)
- Approve both ADRs before coding
- Dogfood on a real epic during Sprint 13-14

### Success criteria for V1-light MVP

By end of Sprint 14, the user can run:

```
cop1 orchestrator run --epic EA-target --step-by-step
```

And obtain:
1. A sequential execution of create-story → dev-story → code-review for each story of the target epic
2. Pauses between commands with confirmation prompts
3. A readable markdown transcript file at `.cop1/transcripts/session-{id}.md` capturing questions, answers, decisions, and state changes
4. A preserved git worktree with isolated changes ready for PR

### Blocking dependencies

| Story | Blocked by |
|---|---|
| EA10-S7 | EA11-S5 (ADR-014) |
| EA10-S4 | EA11-S4 (ADR-013), EA11-S5 (ADR-014), EA11-S3 |
| EA10-S9 | EA10-S1..6, EA10-S7/3, EA6 |

### Non-blocking but recommended

- Real Agent SDK integration spike as Task 0 of EA10-S7 (EA9 retro lesson)
- Ensure epics.md documents EA11 as a new epic with its own section

---

## Appendix — Code audit reference

### Files audited
- `packages/app/src/composition/SprintRunner.ts` — **KEEP**: real responsibilities (worktree, session, checkpoint, event emission), not a hardcoded pipeline
- `packages/app/src/composition/PipelineStepFactory.ts` — **DEPRECATE**: dispatches on `config.workflow.useBMAD`, legacy path references old agents
- `packages/sprint-core/src/features/dev-agent/application/DevAgent.ts` — **DEPRECATE** (67 lines, contains worktree logic to extract into EA11-S3)
- `packages/sprint-core/src/features/reviewer-agent/application/ReviewerAgent.ts` — **DEPRECATE** (53 lines, rejection loop logic to migrate into playbook/orchestrator)
- `packages/sprint-core/src/features/qa-agent/application/QAAgent.ts` — **DEPRECATE** (65 lines)
- `packages/sprint-core/src/features/pm-agent/application/PMAgent.ts` — **DEPRECATE** (79 lines, no callers, dead)
- `packages/sprint-core/src/features/pm-agent/application/PMAgentWorkflowStep.ts` — **DEPRECATE** (70 lines)
- `packages/sprint-core/src/features/workflow/infrastructure/steps/{Dev,Reviewer,QA,PM}AgentStep.ts` — **DEPRECATE** (12 lines each, empty stubs)
- `packages/sprint-core/src/features/bmad-orchestration/application/BMADSessionStep.ts` — **KEEP**: 273 lines, generic and production-ready
- `packages/sprint-core/src/features/bmad-orchestration/application/SupervisorService.ts` — **EXTEND**: add multi-step loop, agent consultation port (EA10-S8)

### Lines of code impact
- ~382 lines deprecated (not deleted)
- ~600-900 lines expected added for EA11-S3 extraction + SUPER enrichment + ORCH expansion + EA11-S7

---

**End of proposal**
