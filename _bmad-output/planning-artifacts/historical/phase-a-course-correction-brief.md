# Course Correction Brief — BMAD Pivot (Phase A)

**Date:** 2026-02-22
**Author:** elzinko (Project Lead) + Claude (Architect/Dev)
**Status:** Ready for PM review
**Type:** Major pivot — replaces Phase 2+ epics E13-E20 with new EA1-EA5 structure

---

## 1. Issue Summary

### What changed

After completing Sprints 0-7 (Epics E1-E12, 102/106 stories done), a global retrospective revealed that **cop1 should not replicate BMAD's battle-tested agent workflows**. Instead of building custom LLM prompts (E13 Prompt Composer), cop1 should orchestrate BMAD commands via `claude -p "/bmad-bmm-dev-story" --output-format json --permission-mode acceptEdits`.

### Why this pivot

1. **BMAD dev-story** is a 10-step workflow with AC validation, project conventions, structured parsing — vs cop1's 14-line DevAgent prompt
2. **BMAD code-review** is an adversarial checklist with 50+ checks — vs cop1's 25-character ReviewerAgent prompt
3. **BMAD QA, retro, sprint-planning** workflows already exist and are proven
4. cop1's hexagonal architecture (ports/adapters) makes the swap trivial: replace `LLMGateway` adapters with `BMADCommandPort` adapters

### The key insight

**BMAD excels at defining WHAT each agent does** (dev-story 10-step, code-review checklist, QA validation).
**cop1 excels at controlling HOW agents are orchestrated** (scheduling, isolation, budget, governance).
They are complementary, not competing.

A BMAD Extension Module alone cannot replace cop1 because it runs in a single Claude Code session:
- Cannot launch each step in a separate prompt
- Cannot route to different models per agent
- Cannot track budget across steps
- Cannot checkpoint/resume between steps (crash = everything lost)
- Cannot timeout/retry per step
- Cannot suspend if RAM insufficient
- Cannot enforce governance (iamthelaw rules, retro → proposals)

---

## 2. Disposition of Existing Phase 2+ Epics (E13-E20)

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

---

## 3. New Epic Structure — Phase A (Sprints 8-12)

### EA1 — BMAD Command Orchestration

**Goal:** cop1 executes BMAD dev-story/review/QA commands via Claude Code CLI, replacing raw LLM calls.

**Technical approach:**
- New hexagonal port `BMADCommandPort` in `@cop1/sprint-core`
- Adapter `ClaudeCliAdapter` using `child_process.spawn('claude', ['-p', command, '--output-format', 'json', '--permission-mode', 'acceptEdits'])`
- New `BMADDevStoryStep`, `BMADReviewStep`, `BMADQAStep` implementing `WorkflowStep`
- `SprintRunner.buildRealSteps()` switches from LLM-based to BMAD-based pipeline

**Stories:**

| ID | Name | Description | Status |
|----|------|-------------|--------|
| EA1-S1 | BMADCommandPort + ClaudeCliAdapter | Port interface + adapter (spawn claude CLI, parse JSON, handle errors/timeouts, emit llm events) | **DONE** (commit 4dbe595) |
| EA1-S2 | BMADDevStoryStep | WorkflowStep wrapping `/bmad-bmm-dev-story` with story context injection | **DONE** (commit 4dbe595) |
| EA1-S3 | BMADReviewStep | WorkflowStep wrapping `/bmad-bmm-code-review` | **DONE** (commit 4dbe595) |
| EA1-S4 | BMADQAStep | WorkflowStep wrapping QA validation via BMAD | Backlog |
| EA1-S5 | SprintRunner BMAD wiring | Replace `buildRealSteps()` to use BMAD steps, keep LLM steps as fallback | Backlog |
| EA1-S6 | Story context preparation | Format story markdown + project context for BMAD command input | **DONE** (commit 4dbe595) |
| EA1-S7 | Error handling & retry | BMAD command failures, timeouts, Claude API errors, budget exhaustion | Backlog |
| EA1-S8 | Integration test | End-to-end: `cop1 sprint run` executes BMAD dev-story on a real story | Backlog |

**Files created (Sprint 8):**
- `packages/sprint-core/src/features/bmad-orchestration/domain/ports/BMADCommandPort.ts`
- `packages/sprint-core/src/features/bmad-orchestration/infrastructure/ClaudeCliAdapter.ts`
- `packages/sprint-core/src/features/bmad-orchestration/application/BMADCommandStep.ts` (base class)
- `packages/sprint-core/src/features/bmad-orchestration/application/BMADDevStoryStep.ts`
- `packages/sprint-core/src/features/bmad-orchestration/application/BMADReviewStep.ts`
- `packages/sprint-core/src/features/bmad-orchestration/domain/StoryContextBuilder.ts`
- Tests: `__tests__/ClaudeCliAdapter.test.ts`, `BMADDevStoryStep.test.ts`, `BMADReviewStep.test.ts`, `StoryContextBuilder.test.ts`

---

### EA2 — Budget & Consumption Tracking

**Goal:** Track Claude API token consumption, enforce limits, emit alerts.

**Elevated from E14** with simplifications: focus on Claude API (not Ollama), simpler initial implementation.

| ID | Name | Description |
|----|------|-------------|
| EA2-S1 | TokenBudgetService | Count tokens from `llm.call.completed` events (or BMAD command output), persist in `.cop1/budget-{date}.yaml` |
| EA2-S2 | Budget config | `cop1.config.yaml` section `budget:` with `sprint_max_tokens`, alert thresholds |
| EA2-S3 | Budget alert system | Emit `budget.warning` / `budget.exceeded` events at 50%, 80%, 95% |
| EA2-S4 | Pre-call budget check | Verify budget before launching BMAD command, reject if exhausted |
| EA2-S5 | Budget CLI | `cop1 budget status` showing consumption breakdown |
| EA2-S6 | Claude usage API adapter | Query Claude API for actual consumption (port `CloudUsagePort`) |

---

### EA3 — Enhanced Dashboard

**Goal:** Dashboard with sprint overview, replay, scrum metrics, and UX preview.

**Merged from E16** + UX preview capability + ceremony reports.

| ID | Name | Description |
|----|------|-------------|
| EA3-S1 | Sprint Replay Engine | Parse JSONL events, serve via `GET /api/sprint/{id}/replay` |
| EA3-S2 | Sprint Replay UI | React timeline with play/pause/step controls, color-coded by agent |
| EA3-S3 | Sprint Overview & KPI scorecard | Landing page with metrics from `SprintDashboardService` + `KPIsDashboardService` |
| EA3-S4 | Scrum Metrics View | Burndown/burnup charts using `BurndownCalculator` + `VelocityProjector` |
| EA3-S5 | Budget View | Token consumption visualization (depends on EA2) |
| EA3-S6 | Ceremony Reports View | List ceremonies from `.cop1/ceremonies/`, render markdown |
| EA3-S7 | UX Preview | Display UX design artifacts (mockups/wireframes) in dashboard |

**Prerequisite:** Run `/bmad-bmm-create-ux-design` with existing brief at `_bmad-output/planning-artifacts/ux-design-brief.md` before implementing UI stories.

---

### EA4 — Auto-Retro & Scrum Reconciliation

**Goal:** Automated retrospective using BMAD retro workflow, DoR gate, smart abandonment.

| ID | Name | Description |
|----|------|-------------|
| EA4-S1 | DoR Gate | `SprintRunner` runs `DORValidator` before each story, skip non-DoR with `--skip-dor` override |
| EA4-S2 | Smart Story Abandonment | Max rejections → `blocked` status, continue to next story, log for retro |
| EA4-S3 | BMAD Retro Step | `BMADRetroStep` launching `/bmad-bmm-retro` via `BMADCommandPort` after sprint completion |
| EA4-S4 | Retro metrics injection | Feed sprint metrics (KPIs, blocages, rejections) as context to BMAD retro command |
| EA4-S5 | Retro output processing | Parse retro output, extract action items, feed into rule proposals |
| EA4-S6 | Retro-to-rules loop | Proposed rules → `RuleProposalService` → sidecar sync (EA5) |

---

### EA5 — BMAD Sidecar Sync

**Goal:** Bidirectional sync between cop1 rules and BMAD agent memory.

**Extracted from E13-S6 and E13-S7** — the only parts of E13 that remain relevant.

| ID | Name | Description |
|----|------|-------------|
| EA5-S1 | Sidecar sync service | Sync `.cop1/rules/active-rules.yaml` → `_bmad/_memory/iamthelaw-sidecar/rules.md` (LLM-friendly markdown) |
| EA5-S2 | BMAD customize.yaml setup | `cop1 init-bmad-bridge` command configuring `_bmad/_config/agents/` customize files with `critical_actions` loading sidecar |
| EA5-S3 | Auto-sync on rule change | EventBus listener: when rules change → trigger sidecar sync automatically |

**BMAD mechanisms used:**
- **customize.yaml**: Agent configuration override. `critical_actions` APPEND to base agent → load sidecar at activation. Base agent (dev, qa, sm) keeps all BMAD prompts intact.
- **Sidecar memory**: Persistent markdown at `_bmad/_memory/{agent}-sidecar/`. Read/write by agent. Contains rules organized by theme.
- Pattern validated by existing tech-writer sidecar at `_bmad/_memory/tech-writer-sidecar/`.

---

## 4. Sprint Ordering

### Sprint 8 — BMAD Command Foundation (PARTIALLY DONE)

**Done:** EA1-S1, EA1-S2, EA1-S3, EA1-S6 (commit `4dbe595`)
**Remaining:** Story files not yet created in `_bmad-output/planning-artifacts/stories/sprint-8/`

### Sprint 9 — Full BMAD Pipeline + Sidecar + Budget Start

- EA1-S4 (BMADQAStep)
- EA1-S5 (SprintRunner wiring)
- EA1-S7 (Error handling & retry)
- EA5-S1, EA5-S2, EA5-S3 (Sidecar sync)
- EA2-S1, EA2-S2 (TokenBudgetService + config)

**Goal:** Complete BMAD pipeline, cop1 rules visible to BMAD agents, budget tracking started.

### Sprint 10 — Budget Enforcement + Dashboard Start

- EA2-S3, EA2-S4, EA2-S5 (Alerts + pre-call check + CLI)
- EA1-S8 (Integration test)
- EA3-S1, EA3-S2 (Sprint Replay Engine + UI)
- **Prerequisite:** Run UX design with Sally before this sprint

### Sprint 11 — Dashboard Complete

- EA3-S3, EA3-S4, EA3-S5, EA3-S6 (Overview + Scrum Metrics + Budget View + Ceremonies)
- EA3-S7 (UX Preview)
- EA4-S1 (DoR Gate)

### Sprint 12 — Auto-Retro & Scrum Loop

- EA4-S2, EA4-S3, EA4-S4, EA4-S5, EA4-S6 (Smart abandonment + BMAD retro + rules loop)
- EA2-S6 (Claude usage API)

**Goal:** Autonomous sprint-to-retro loop, closed improvement cycle.

---

## 5. Architecture Decisions

### Pattern: cop1 as Orchestrator, BMAD as Executor

cop1's role is limited to:
1. **Scheduling** and orchestrating BMAD command execution (via `BMADCommandPort`)
2. **Capturing** output and metrics (sprint-log JSONL, budget tracking)
3. **Managing** governance (iamthelaw rules, retro outputs)
4. **Providing** checkpoint/resume, error handling, resource management

BMAD agents are autonomous — cop1 launches them and records results.

### Execution Gateway Pattern

`BMADCommandPort` (interface) + `ClaudeCliAdapter` (implementation) as Strategy pattern:
- `LocalCliAdapter` — current: runs `claude -p` in local terminal
- `ContainerAdapter` — future: runs in isolated Docker container
- `RemoteAdapter` — future: delegates to remote Claude Code instance

### sprint-status.yaml Ownership (Technical Debt — HIGH)

**Current state:** cop1 stores `sprint-status.yaml` in `.cop1/` (hardcoded in `YamlStatusStore`).
**BMAD expectation:** Sprint-planning workflow generates it in `_bmad-output/implementation-artifacts/`.
**Target:** cop1 reads from BMAD's path, writes only its own execution history to `.cop1/sprint-log-*.jsonl`.
**Action:** Refactor `YamlStatusStore` to read from BMAD's expected path.

---

## 6. Technical Debt & Backlog Items from Retro

### Technical Debt

| Item | Priority | Action |
|------|----------|--------|
| sprint-status.yaml path mismatch | HIGH | Refactor YamlStatusStore → read from `_bmad-output/implementation-artifacts/` |
| ReviewerAgent weak prompt | LOW | Obsoleted by BMADReviewStep |
| QAAgent stub | LOW | Replaced by BMADQAStep (EA1-S4) |
| 4 stories in backlog (E9-S5, E10-S9, E11-S10, E12-S6b) | MEDIUM | Evaluate relevance post-pivot |

### Future Items (not in Phase A)

| Item | Type | Note |
|------|------|------|
| Sprint visualization with Plane.so sync | Future Epic | Read-only sync for epic/story/task visualization |
| Unified backlog tracking for non-dev tasks | Future Epic | No tracking for ideation/PM/UX tasks currently |
| Agent customization versioning | Future Epic | Track customize.yaml evolution over time |

---

## 7. Existing Code to Reuse

### Already implemented (E1-E12):
- `packages/sprint-core/src/features/workflow/` — WorkflowEngine, WorkflowStep interface
- `packages/sprint-core/src/features/dor-validator/` — DORValidator (for EA4-S1)
- `packages/sprint-core/src/features/kpis-dashboard/` — KPIsDashboardService
- `packages/sprint-core/src/features/burndown/` — BurndownCalculator
- `packages/sprint-core/src/features/velocity-projector/` — VelocityProjector
- `packages/sprint-core/src/features/rule-proposal/` — RuleProposalService
- `packages/sprint-core/src/features/auto-rule-suggestion/` — AutoRuleSuggestionService
- `packages/sprint-core/src/features/iamthelaw/` — IamTheLawLoader
- `packages/ceremony-engine/` — ceremony infrastructure
- `packages/web/` — React app, dark theme, card layout
- `packages/app/src/features/daemon/infrastructure/HttpServer.ts` — HTTP routes

### Already implemented (Sprint 8 / EA1):
- `packages/sprint-core/src/features/bmad-orchestration/` — BMADCommandPort, ClaudeCliAdapter, BMADDevStoryStep, BMADReviewStep, StoryContextBuilder

---

## 8. Discussion History Summary

### Key decisions from retro discussion (2026-02-22):

1. **BMAD pivot confirmed** as the correct strategic decision after analyzing all 12 epics
2. **customize.yaml vs sidecar vs Extension Module** analyzed in depth:
   - customize.yaml = agent config (who it is), YAML structured, persona REPLACES, actions APPEND
   - Sidecar = agent memory (what it knows), markdown free-form, read/write by agent
   - Extension Module = add agents/workflows to BMM, same-name overrides, different-name adds
3. **Extension Module cannot replace cop1**: runs in single session, no separate prompts/models/budget per step
4. **EA5 validated against ADR-007**: sidecar pattern is the right approach, no redefinition needed
5. **sprint-status.yaml**: cop1 should stop maintaining its own copy, read from BMAD's path instead
6. **cop1 should just launch BMAD commands** and let BMAD manage its own files (stories, sprint-status, artifacts)
7. **Sprints 0-7 velocity was artificially high** because Claude developed directly (not via bmad-bmm-dev-story). Expect lower velocity but higher quality with BMAD workflows.

### User priorities (ordered):
1. Automate BMAD command execution for dev sprints (no human intervention)
2. BMAD retrospective automation
3. Dashboard UI for monitoring & reports
4. Budget/consumption tracking & alerts
5. UX preview capability in dashboard

### Deferred to later phases:
- Local LLM fallback and smart escalade (Phase B)
- Agent Lab & Scoring (Phase B)
- Interactive mode (Phase B)
- Configurable pipeline (Phase B)
- BMAD iamthelaw module (Phase C)
- CoachAgent (Phase C)
- DevOps/deployment pipeline
- Demo generation
- Agent marketplace / custom agents
