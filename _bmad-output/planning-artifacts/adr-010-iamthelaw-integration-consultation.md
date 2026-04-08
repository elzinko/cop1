# ADR-010 — iamthelaw Integration Consultation: Two-Component Architecture

**Date:** 2026-03-09 (initial), 2026-03-11 (revised)
**Status:** Accepted
**Authors:** elzinko, Claude Opus 4.6
**Context:** EA2-S0c Consultation Story — Sprint 10
**Supersedes:** None (extends ADR-007)
**Related:** ADR-007 (2-layer architecture), ADR-008 (BMAD Execution Gateway), ADR-009 (sprint-status ownership)
**Sprint Change Proposal:** SCP 2026-03-11 (Epic EA7 approved)

---

## 1. Executive Summary

This ADR resolves the architectural questions raised in SCP 2026-03-09 (C4) and the EA1 retrospective regarding the activation of the iamthelaw rules engine. The consultation evolved through two phases:

- **Phase 1 (2026-03-09):** Initial analysis concluded "integrated code in cop1" — answered 6 questions about activation strategy
- **Phase 2 (2026-03-11):** Deeper consultation identified broader vision — **two-component architecture** with a standalone BMAD module for interactive rule management and cop1 as the programmatic infrastructure with a REST API

The final decision: **BMAD Module "iamthelaw" (standalone, zero TypeScript) + cop1 programmatic API (REST /api/rules)**, sharing a filesystem contract (`iamthelaw/*.yaml`). The cop1 domain model (categories: global/scrum/architecture/agents) is enriched with severity levels (MUST/SHOULD/MAY) from iamthelaw.

---

## 2. Current State Inventory

### 2.1 Code Exists — Engine is Complete but Inert

All iamthelaw infrastructure was built in Phase 1 (E9) and Phase A (EA5). The code is tested, exported, and architecturally sound. However, **zero rules exist on disk** — the engine has no fuel.

| Component | Package | Status | Wired? |
|-----------|---------|--------|--------|
| `IamTheLawLoader` | sprint-core | ✅ Complete, tested | ❌ Not instantiated |
| `SidecarSyncService` | sprint-core | ✅ Complete, tested | ❌ Not instantiated |
| `SidecarSyncListener` | sprint-core | ✅ Complete, tested | ❌ Not instantiated |
| `FileSidecarAdapter` | sprint-core | ✅ Complete, tested | ❌ Not instantiated |
| `RuleSet` domain model | sprint-core | ✅ Complete | ✅ Used by all above |
| `RuleProposalService` | sprint-core | ✅ Complete, tested | ❌ Not wired in DaemonService |
| `DoDService` | sprint-core | ✅ Complete, tested | ❌ Not instantiated |
| `DoDLimiter` | sprint-core | ✅ Complete, tested | ❌ Not instantiated |
| `RuleApplicationService` | app | ✅ Complete, tested | ❌ Not instantiated |
| `BmadBridgeService` | app | ✅ Complete, tested | ⚠️ CLI exists, not activated |
| Rule Approval UI | web | ✅ Complete, tested | ⚠️ HTTP routes exist, no backend provider |
| customize.yaml files | _bmad/_config | ✅ All exist | ❌ Empty `critical_actions: []` |

### 2.2 What Does NOT Exist on Disk

| Expected Artifact | Path | Status |
|-------------------|------|--------|
| Sidecar directory | `_bmad/_memory/iamthelaw-sidecar/` | ❌ Not created |
| Sidecar rules markdown | `_bmad/_memory/iamthelaw-sidecar/rules.md` | ❌ Not created |
| Machine-readable rules | `.cop1/rules/active-rules.yaml` | ❌ Not created |
| Global rules YAML | `iamthelaw/global.yaml` | ❌ Not created |
| Scrum rules YAML | `iamthelaw/scrum.yaml` | ❌ Not created |
| Architecture rules YAML | `iamthelaw/architecture.yaml` | ❌ Not created |
| Agent rules directory | `iamthelaw/agents/` | ❌ Not created |
| Audit trail | `iamthelaw/history.jsonl` | ❌ Not created |
| Team DoD file | (location undecided) | ❌ Not created |

### 2.3 ADR-007 Decisions Already Made

ADR-007 (2026-02-22) established:
- **Two-layer coexistence:** BMAD (interactive) + cop1 daemon (autonomous)
- **Sidecar mechanism:** cop1 rules synced to `_bmad/_memory/iamthelaw-sidecar/` for BMAD agents
- **File zones contract:** Defines read/write permissions for shared files
- **PromptComposer pattern:** Aggregates project context + iamthelaw rules + agent memory + story content

This consultation **validates and extends** ADR-007, not replaces it.

---

## 3. Decision: Integration Model

### Question: What architecture for iamthelaw — npm dependency, integrated code, or something else?

### Decision: **Two-component architecture — BMAD Module + cop1 programmatic API**

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  COMPONENT 1: MODULE BMAD "iamthelaw" (standalone)          │
│  Installable in any BMAD project, with or without cop1      │
│                                                             │
│  🤖 Agent: Judge Dredd (admin, export, import, audit)       │
│  🔄 Workflow: retro-to-rules (used by SM during retros)     │
│  🔄 Workflow: export-rules / import-rules (portability)     │
│  📖 Sidecar: rules.md (LLM view for all BMAD agents)       │
│  ⚙️ Config: module.yaml with category/level settings        │
│                                                             │
│  Zero TypeScript code — pure BMAD (markdown agents, YAML)   │
│  Filesystem contract: reads/writes iamthelaw/*.yaml         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  COMPONENT 2: cop1 (programmatic consumer)                  │
│  LLM-independent infrastructure for storage and querying    │
│                                                             │
│  🌐 API: /api/rules (GET list+filter, POST proposals,       │
│          GET export) — new RulesApiHandler                   │
│  📦 Domain: Rule + RuleSet (enriched with level)            │
│  📦 Services: IamTheLawLoader, SidecarSyncService,          │
│     RuleApplicationService, RuleProposalService             │
│  📦 Adapters: FileSidecarAdapter, SidecarSyncListener       │
│  🖥️ Web: Rule Approval UI                                   │
│                                                             │
│  Filesystem contract: reads/writes iamthelaw/*.yaml         │
└─────────────────────────────────────────────────────────────┘
```

### Analysis — Why Two Components, Not One

| Criterion | npm Package | Integrated Code Only | **Two Components (chosen)** |
|-----------|------------|---------------------|-----------------------------|
| **Reusability outside cop1** | ✅ npm install | ❌ cop1-specific | ✅ BMAD module installable in any project |
| **Agent interaction** | ❌ LLMs don't call npm | ❌ Agents need sidecar hack | ✅ Module provides native agent + workflows |
| **Programmatic access** | ✅ API | ❌ Internal code only | ✅ REST API /api/rules |
| **Storage independence** | Varies | YAML files, TS code | ✅ YAML storage, REST API for querying |
| **Complexity** | High (2 repos, CI) | Low | Medium (module + API handler) |
| **Future extraction** | Already extracted | Need to extract later | Hexagonal ports ready for npm extraction when needed |

### Rationale

1. **BMAD agents are LLMs** — they don't call `npm install`, they read files and follow workflows. A BMAD module provides native integration (agent menus, structured workflows) that agents understand.
2. **cop1 programmatic code stays in cop1** — `IamTheLawLoader`, `SidecarSyncService`, `RuleApplicationService` are cop1-specific. No premature extraction.
3. **REST API unifies access** — daemon, web UI, CLI, and BMAD module all query rules through `/api/rules`. Storage-agnostic (YAML today, could be SQLite later).
4. **The BMAD module is standalone** — it works without cop1 (agents read/write YAML directly). With cop1, it gains automation (event-driven sync, auto-suggestions from retros).
5. **Hexagonal architecture provides the escape hatch** — if a second programmatic consumer appears, extract domain layer as npm package via existing ports (`RuleLoaderPort`, `SidecarSyncPort`).

### Role Separation — Who Does What

| Role | Creates/Modifies Rules | Reads Rules | Administers Rules |
|------|----------------------|-------------|-------------------|
| **Retro agents** (SM + team) | ✅ Via `retro-to-rules` workflow | — | — |
| **All BMAD agents** (dev, QA, arch) | — | ✅ Automatically via sidecar critical_actions | — |
| **Judge Dredd agent** | — | ✅ | ✅ Export, import, audit, health check |
| **cop1 daemon** | ✅ Via RuleProposalService (auto-suggestions) | ✅ Via IamTheLawLoader | ✅ Via RuleApplicationService |
| **Human (elzinko)** | ✅ Via Rule Approval UI | ✅ Via web or CLI | ✅ Via Judge Dredd or CLI |

### Future Consideration

If a second project needs iamthelaw as a programmatic library, extract the **domain layer only** (`RuleSet`, `Rule`, `RuleLoaderPort`) as `@elzinko/iamthelaw-core` npm package. Keep cop1-specific adapters in cop1. The BMAD module already provides non-programmatic reusability.

---

## 4. BMAD/iamthelaw Coupling Risk Analysis

### Question: How does BMAD handle rules? What's the duplication risk?

### BMAD's Native Rule Mechanisms

| Mechanism | How It Works | Scope |
|-----------|-------------|-------|
| **Agent personas** | Hardcoded in `_bmad/bmm/agents/*.md` files | Agent behavior, communication style |
| **Workflow instructions** | Embedded in workflow XML/YAML files | Step-by-step process |
| **`customize.yaml`** | Override persona, add critical_actions, memories | Per-agent customization |
| **`project-context.md`** | Project-wide conventions loaded by all workflows | Tech stack, coding standards |
| **Validation checklists** | Embedded in workflow definitions | Quality gates |

### iamthelaw Rule Categories (from `RuleSet` domain)

| Category | Purpose | Example |
|----------|---------|---------|
| `global` | Team-wide rules | R5: Every story must have a story file |
| `scrum` | Process rules | Sprint time-boxing, ceremony requirements |
| `architecture` | Technical rules | R1: Port components need integration tests |
| `agents` | Per-agent rules | Reviewer must check barrel exports (R3) |

### Coupling Risk Matrix

| Risk | Severity | Description | Mitigation |
|------|----------|-------------|------------|
| **Rule duplication** | MEDIUM | BMAD personas already encode agent behavior; iamthelaw agent rules could duplicate | **Separation of concerns:** BMAD personas = identity/style, iamthelaw agent rules = learned constraints from retros |
| **project-context.md overlap** | LOW | project-context.md has coding standards; iamthelaw global rules could overlap | **Clear boundary:** project-context = stable conventions, iamthelaw = evolving rules from experience |
| **Workflow constraint overlap** | LOW | BMAD workflows have validation checklists; iamthelaw DoD could duplicate | **Clear boundary:** BMAD checklists = workflow-specific, DoD = cross-workflow quality gate |
| **customize.yaml complexity** | LOW | Adding critical_actions to load sidecar adds cognitive load | **One-time setup:** `cop1 init-bmad-bridge` does it once, idempotent |
| **Stale sidecar** | MEDIUM | If rules change but sync fails, BMAD agents read outdated rules | **Already mitigated:** SidecarSyncListener is error-resilient, retries on next event |

### Separation of Concerns — Final Model

```
┌─────────────────────────────────────────────────────┐
│  BMAD-NATIVE (static, human-authored)               │
│                                                     │
│  • Agent personas (identity, communication style)   │
│  • Workflow instructions (step-by-step process)     │
│  • project-context.md (tech stack, conventions)     │
│  • Validation checklists (workflow-specific gates)   │
│                                                     │
│  Owner: BMAD framework + human (elzinko)            │
│  Lifecycle: Updated manually or at BMAD install     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  IAMTHELAW-MANAGED (evolving, machine-learned)      │
│                                                     │
│  • Global rules (team DoD, cross-cutting lessons)   │
│  • Scrum rules (process improvements from retros)   │
│  • Architecture rules (boundary/contract rules)     │
│  • Agent rules (per-agent learned constraints)      │
│                                                     │
│  Owner: cop1 daemon (via retro → rule pipeline)     │
│  Lifecycle: Auto-updated after each retrospective   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  SHARED MECHANISM (sidecar sync)                    │
│                                                     │
│  • customize.yaml critical_actions → load sidecar   │
│  • _bmad/_memory/iamthelaw-sidecar/rules.md         │
│  • Both BMAD agents AND cop1 agents read rules      │
│                                                     │
│  Owner: cop1 writes, both layers read               │
│  Lifecycle: Synced on every rule change event        │
└─────────────────────────────────────────────────────┘
```

### Key Principle: BMAD = Identity, iamthelaw = Learned Experience

- BMAD tells agents **who they are** and **how to work** (static)
- iamthelaw tells agents **what to avoid** based on **what went wrong** (evolving)
- No overlap when this boundary is respected

---

## 5. Developer Sidecar Pattern

### Question: How does the developer read rules via iamthelaw during BMAD execution?

### Sync Flow (ADR-007 validated)

```
┌──────────────────────┐     ┌──────────────────────────┐     ┌─────────────────────────────────┐
│  iamthelaw/ dir      │     │  SidecarSyncService      │     │  _bmad/_memory/iamthelaw-       │
│                      │     │                          │     │  sidecar/rules.md               │
│  global.yaml         │────▶│  1. Load via             │────▶│                                 │
│  scrum.yaml          │     │     RuleLoaderPort       │     │  LLM-friendly markdown:         │
│  architecture.yaml   │     │  2. Format to markdown   │     │  # Active Rules                 │
│  agents/*.yaml       │     │  3. Write via            │     │  ## Global Rules                │
│                      │     │     SidecarSyncPort      │     │  - **R1**: description (source)  │
│  (YAML — machine)    │     │  (FileSidecarAdapter)    │     │  ## Architecture Rules           │
└──────────────────────┘     └──────────────────────────┘     │  - **R3**: description (source)  │
                                                              │  > Last synced: ISO-timestamp    │
                                                              │  (Markdown — LLM)               │
                                                              └─────────────────────────────────┘
                                                                          │
                                                                          ▼
                                                              ┌─────────────────────────────────┐
                                                              │  BMAD Agent (via customize.yaml) │
                                                              │                                 │
                                                              │  critical_actions:              │
                                                              │  - "Load ...rules.md"           │
                                                              │                                 │
                                                              │  Agent reads rules at activation │
                                                              └─────────────────────────────────┘
```

### Refresh Strategy: **Event-driven** (recommended, already implemented)

| Strategy | Pros | Cons | Verdict |
|----------|------|------|---------|
| Event-driven (on rule change) | ✅ Immediate, no polling, already coded (SidecarSyncListener) | Requires EventBus wiring | **RECOMMENDED** |
| Periodic (cron/timer) | Simple, doesn't need EventBus | Stale between intervals, unnecessary I/O | Not recommended |
| On-demand (CLI command) | User-controlled | Manual, forgettable | Useful as fallback only |

The `SidecarSyncListener` already implements event-driven refresh:
- Listens to `rule.applied` and `rule.rejected` events
- Triggers `SidecarSyncService.sync()` immediately
- Error-resilient: never blocks rule processing
- Natural retry on next event

### File Format

**Machine rules** (`iamthelaw/*.yaml`) — enriched with severity levels:
```yaml
rules:
  - id: "R1"
    description: "Any component exposing a port must have an integration test with a real adapter"
    level: MUST           # MUST | SHOULD | MAY — defaults to MUST if absent
    source: "EA1-S8 retro — 429 bug"
```

**LLM-friendly sidecar** (`_bmad/_memory/iamthelaw-sidecar/rules.md`):
```markdown
# Active Rules
> Last synced: 2026-03-09T14:30:00.000Z

## Global Rules
- **R1** [MUST]: Any component exposing a port must have an integration test with a real adapter (source: EA1-S8 retro — 429 bug)
- **R5** [SHOULD]: Every story must have a story file in implementation-artifacts (source: EA1 traceability gap)

## Architecture Rules
- **R3** [MUST]: Barrel exports must be verified for every new public class (source: EA1-S4 review)

## Scrum Rules
(none yet)

## Agent Rules
### dev
- **R4** [MUST]: Default values in code must exactly match story AC specifications (source: EA1-S7 timeout)

### reviewer
- **R2** [MUST]: Return values false vs undefined vs null must be documented in port contracts (source: EA1-S8 H1)
```

**REST API** (`GET /api/rules`):
```json
{
  "rules": [
    { "id": "R1", "description": "...", "level": "MUST", "source": "...", "category": "global" },
    { "id": "R3", "description": "...", "level": "MUST", "source": "...", "category": "architecture" }
  ],
  "filters": { "category": "all", "level": "all", "agent": null },
  "total": 5,
  "lastSynced": "2026-03-09T14:30:00.000Z"
}
```

---

## 6. Joint Improvement Plan

### Question: How to improve iamthelaw and cop1 jointly without circular dependencies?

### Principle: Unidirectional Data Flow

```
Retrospective → Rule Proposals → Rule Application → Sidecar Sync → Agent Consumption
     (input)        (human/AI)       (cop1 writes)     (cop1 writes)    (BMAD reads)
```

No circular dependency exists because:
1. **Rules flow in one direction:** retro findings → rule YAML → sidecar markdown → agent reads
2. **cop1 writes, BMAD reads:** clear ownership per ADR-007 file zones contract
3. **Rule proposals are decoupled:** `RuleProposalService` holds proposals in memory; `RuleApplicationService` writes to filesystem; `SidecarSyncService` reads from filesystem. No direct coupling.

### Improvement Process

| Step | Actor | Action | Output |
|------|-------|--------|--------|
| 1 | Retrospective (cop1 auto or BMAD ceremony) | Identify lessons learned | Retro findings |
| 2 | Human or AutoRuleSuggestionService | Create rule proposal | `RuleProposalRecord` (pending) |
| 3 | Human (via Rule Approval UI) | Approve/reject/debate | Status update → `rule.applied` event |
| 4 | `RuleApplicationService` | Write rule to `iamthelaw/*.yaml` | YAML file updated |
| 5 | `SidecarSyncListener` | Trigger sync on `rule.applied` event | `rules.md` updated |
| 6 | BMAD agents (next activation) | Read `rules.md` via `critical_actions` | Rules internalized |

### How to Improve iamthelaw Itself

Since iamthelaw is integrated code, improvements follow normal cop1 development:
- Bug fixes → `fix: ` commit in cop1
- New features → story in cop1 backlog → standard BMAD dev workflow
- Domain model changes → update `RuleSet` interface, propagate to adapters
- No cross-repo coordination needed

---

## 7. Team DoD Location Decision

### Question: Where should the team Definition of Done file live?

### Options Evaluated

| Option | Path | Owner | Pros | Cons |
|--------|------|-------|------|------|
| **A** | `iamthelaw/global.yaml` → `dod:` field | cop1 | ✅ `DoDService` already reads from here; single source of truth for machine rules | ❌ Mixes DoD with other global rules; YAML not human-friendly for DoD definition |
| **B** | `_bmad/_memory/iamthelaw-sidecar/dod.md` | cop1 | ✅ BMAD agents can read directly; LLM-friendly | ❌ Derived file, not source of truth; would need separate sync for DoD |
| **C** | `.cop1/rules/team-dod.yaml` | cop1 | ✅ Clean separation; cop1-owned zone per ADR-007 | ❌ `DoDService` would need path change; another YAML file to maintain |

### Decision: **Option A — `iamthelaw/global.yaml` with `dod:` field**

### Rationale

1. **DoDService already reads from `iamthelaw/global.yaml`** — zero code changes needed
2. **Single source of truth** — DoD criteria live alongside global rules, both managed by the same loader
3. **Automatic sidecar sync** — when `global.yaml` changes, `SidecarSyncService` regenerates `rules.md` which includes global rules (and DoD is a global rule)
4. **Consistent with ADR-007** — `iamthelaw/` directory is cop1-owned, cop1 reads/writes

### DoD File Format

```yaml
# iamthelaw/global.yaml
dod:
  - tests_exist
  - tests_pass
  - coverage_met
  - code_reviewed

rules:
  - id: "R1"
    description: "Any component exposing a port must have an integration test with a real adapter"
    level: MUST
    source: "EA1-S8 retro — 429 bug"
  - id: "R5"
    description: "Every story must have a story file in implementation-artifacts"
    level: SHOULD
    source: "EA1 traceability gap"
```

### Note on BMAD DoD Visibility

BMAD agents see the DoD indirectly through `rules.md` (global rules section). For explicit DoD visibility, a future story could add a dedicated `dod.md` sidecar file. This is optional and non-blocking.

---

## 8. Implementation Roadmap

### Epic EA7 — iamthelaw Module BMAD & API REST (Sprint 12)

Approved via SCP 2026-03-11. Full story breakdown in `sprint-change-proposal-2026-03-11.md`.

| Story | Title | Description | Dependency | Effort |
|-------|-------|-------------|------------|--------|
| **EA7-S1** | Enrich Rule model | Add `level: MUST\|SHOULD\|MAY` to `Rule` interface, parse in `IamTheLawLoader`, default MUST if absent | None | Small |
| **EA7-S2** | RulesApiHandler | API REST `/api/rules` — GET (list, filter by category/level/agent), GET /export, POST /proposals | EA7-S1 | Medium |
| **EA7-S3** | Module BMAD — scaffold | Create iamthelaw module: `module.yaml`, `README.md`, standard BMAD structure | None | Small |
| **EA7-S4** | Module BMAD — Agent Judge Dredd | Admin agent: menu list/export/import/audit rules. Reads `iamthelaw/*.yaml` directly | EA7-S3 | Medium |
| **EA7-S5** | Module BMAD — Workflow retro-to-rules | Structured workflow for SM to transform retro lessons into formal rules | EA7-S3 | Medium |
| **EA7-S6** | Module BMAD — Workflow export/import | Export rules as portable YAML, import from another project or template | EA7-S4 | Small |
| **EA7-S7** | Create initial rules R1-R5 | Populate `iamthelaw/*.yaml` with EA1 retro rules (with levels), activate sidecar sync | EA7-S1 | Small |

### Downstream Dependencies

| Story | Depends on EA7 | Detail |
|-------|---------------|--------|
| EA4-S6 | EA7-S2, EA7-S5 | Retro-to-rules loop uses the module workflow and REST API |
| EA4-S1 | EA7-S7 | DoR Gate reads DoD from `iamthelaw/global.yaml` (needs rules to exist) |
| C5 from SCP 2026-03-09 | EA7-S7 | DaemonService wiring of iamthelaw services |

### Quick Start (can be done today, before EA7 stories)

```bash
# Step 1: Create iamthelaw directory with initial rules (with levels)
mkdir -p iamthelaw/agents

# Step 2: Create global.yaml with DoD and initial rules
cat > iamthelaw/global.yaml << 'EOF'
dod:
  - tests_exist
  - tests_pass
  - coverage_met
  - code_reviewed

rules:
  - id: "R1"
    description: "Any component exposing a port must have an integration test with a real adapter (not just mocks)"
    level: MUST
    source: "EA1-S8 retro — 429 retry bug"
  - id: "R5"
    description: "Every story must have a story file in implementation-artifacts (traceability)"
    level: SHOULD
    source: "EA1 retro — S1/S2/S3/S6 missing story files"
EOF

# Step 3: Create architecture.yaml
cat > iamthelaw/architecture.yaml << 'EOF'
rules:
  - id: "R3"
    description: "Barrel exports must be verified for every new public class"
    level: MUST
    source: "EA1-S4 code review"
EOF

# Step 4: Create scrum.yaml (empty for now)
cat > iamthelaw/scrum.yaml << 'EOF'
rules: []
EOF

# Step 5: Create agent-specific rules
cat > iamthelaw/agents/dev.yaml << 'EOF'
rules:
  - id: "R4"
    description: "Default values in code must exactly match story AC specifications"
    level: MUST
    source: "EA1-S7 timeout 600s vs AC 300s"
EOF

cat > iamthelaw/agents/reviewer.yaml << 'EOF'
rules:
  - id: "R2"
    description: "Return values false vs undefined vs null must be documented in port contracts"
    level: MUST
    source: "EA1-S8 H1 — isRetryableError() false vs undefined"
EOF

# Step 6: Run BMAD bridge initialization
npx cop1 init-bmad-bridge
```

---

## 9. Decision Summary

### Phase 1 Decisions (2026-03-09)

| Question (SCP 2026-03-09) | Decision | Rationale |
|---------------------------|----------|-----------|
| Q1: npm dependency vs integrated code? | **Two-component architecture** *(revised 2026-03-11)* | BMAD module for agents + cop1 programmatic API. No npm extraction yet. |
| Q2: BMAD rule duplication risk? | **Low with clear boundary** | BMAD = identity/style (static), iamthelaw = learned experience (evolving) |
| Q3: BMAD/iamthelaw coupling avoidance? | **Sidecar pattern (ADR-007)** | cop1 writes, BMAD reads via customize.yaml critical_actions |
| Q4: Developer sidecar pattern? | **Event-driven sync** | SidecarSyncListener already implemented, triggers on rule changes |
| Q5: Joint improvement process? | **Unidirectional flow** | Retro → proposal → application → sync → agent reads (no circular deps) |
| Q6: Team DoD location? | **`iamthelaw/global.yaml` with `dod:` field** | DoDService already reads from there; zero code changes |

### Phase 2 Decisions (2026-03-11 — SCP 2026-03-11)

| Question | Decision | Rationale |
|----------|----------|-----------|
| Q7: Module BMAD standalone or sidecar only? | **Standalone BMAD module** | Provides agent (Judge Dredd) + workflows reusable in any BMAD project, not just cop1 |
| Q8: LLM-independent infrastructure? | **REST API `/api/rules`** | Unifies access for all consumers (daemon, web, CLI, module). YAML storage sufficient for now |
| Q9: cop1 domain model or iamthelaw model? | **cop1 model enriched with severity levels** | Categories (global/scrum/arch/agents) kept + MUST/SHOULD/MAY added from iamthelaw |

---

## 10. Consequences

### Positive
- **Existing cop1 code validated** — no rewrite needed, only enrichment (add `level` to `Rule`)
- **Reusability achieved without npm overhead** — BMAD module installable in any project
- **Unified access via REST API** — all consumers use `/api/rules` instead of direct YAML parsing
- **ADR-007 validated** — sidecar pattern confirmed as correct approach
- **DoD location settled** — unblocks EA4-S1 (DoR Gate) planning
- **Clear role separation** — retro agents create rules, Judge Dredd administers, all agents read

### Negative
- **New epic needed** — EA7 adds 7 stories and shifts EA3/EA4 by one sprint each
- **BMAD module creation** — first custom module for this project, learning curve for module standards
- **Manual bootstrap still needed** — initial `iamthelaw/*.yaml` files must be created (EA7-S7)

### Risks
- **Rules quality depends on retro quality** — if retrospectives produce vague findings, rules will be vague. Mitigation: human review via Rule Approval UI + Judge Dredd audit workflow
- **Module maintenance** — BMAD module must be kept compatible with BMAD framework updates. Mitigation: module follows BMAD standards, validated via bmb module-builder
- **API surface growth** — `/api/rules` adds to HttpServer surface area. Mitigation: follows existing `StoriesApiHandler` pattern, well-tested

---

## 11. Validation Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial rules populated | 5 rules (R1-R5) with levels | Count rules in `iamthelaw/*.yaml`, verify `level` field present |
| Rule model enriched | `Rule` interface has `level` field | TypeScript compilation, unit tests |
| REST API functional | `/api/rules` returns filtered results | Integration test with RulesApiHandler |
| Sidecar sync functional | `rules.md` contains all rules with levels | Diff rule count between YAML and markdown |
| BMAD module installable | Module passes bmb validation | `bmb validate-module` on iamthelaw module |
| Judge Dredd agent operational | Agent menu loads, export/import work | Manual test via BMAD agent load |
| retro-to-rules workflow functional | SM can create a rule from retro output | Manual test via BMAD workflow |
| BMAD agents load rules | customize.yaml has critical_actions | Check bmm-dev, bmm-qa, bmm-sm files |
| No BMAD core modifications | 0 files modified in `_bmad/core/`, `_bmad/bmm/` | Git diff check |

---

## 12. References

- ADR-007: `_bmad-output/planning-artifacts/historical/adr-007-bmad-cop1-iamthelaw-integration.md`
- ADR-008: `_bmad-output/planning-artifacts/architecture.md` (BMAD Execution Gateway section)
- ADR-009: `_bmad-output/planning-artifacts/architecture.md` (sprint-status ownership section)
- EA1 Retrospective: `_bmad-output/implementation-artifacts/epic-ea1-retro-2026-03-07.md`
- SCP 2026-03-09: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-03-09.md`
- **SCP 2026-03-11: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-03-11.md`**
- BMAD Module Standards: `_bmad/bmb/workflows/module/data/module-standards.md`
- iamthelaw domain: `packages/sprint-core/src/features/iamthelaw/`
- RuleApplicationService: `packages/app/src/features/rule-application/`
- BmadBridgeService: `packages/app/src/features/bmad-bridge/`
- Rule Approval UI: `packages/web/src/RuleProposalsView.tsx`
