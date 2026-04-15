---
title: cop1 — Brownfield Snapshot (working document)
status: working / temporary — generated 2026-04-15 to feed an architecture confrontation session
generated_by: document-project workflow (adapted single-artefact mode)
authoritative_sources:
  - _bmad-output/planning-artifacts/prd.md (823 L, last edit 2026-04-14)
  - _bmad-output/planning-artifacts/architecture.md (1608 L, last update 2026-03-19)
  - _bmad-output/planning-artifacts/adr-013-orchestrator-sprintrunner-separation.md (525 L)
  - _bmad-output/planning-artifacts/adr-014-supervisor-tool-interface.md (1097 L)
  - _bmad-output/implementation-artifacts/epic-ea10-ea11-retro-2026-04-14.md (289 L)
  - _bmad-output/planning-artifacts/epics.md (2645 L)
  - docs/GETTING_STARTED.md (up-to-date)
not_authoritative:
  - README.md, MVP_STATUS.md, ROADMAP.md, NEXT_SPRINT.md, QUICK_START.md (pre-pivot, stale — see §10)
---

# cop1 — Brownfield Snapshot

> **Purpose.** This is a _working_ document produced on 2026-04-15 to feed an architecture confrontation session. It reports the **current state** of the code and the **gap** with planning artefacts, so that the next session can challenge the architecture against the user's evolving need. Do not treat it as long-term documentation — the authoritative planning sources listed above remain canonical.

---

## 1. Identity

**cop1 / Morpheus** is an autonomous AI-agents orchestration system for solo developers. The product promise (_"pendant que tu rêves, le code se construit"_) is: agents pick up stories from a BMAD backlog at night and advance them (create-story → dev-story → code-review → QA → retro) without human intervention, producing committable artefacts by morning.

- **Vision owner:** elzinko (solo dev, M3 Max 64 GB)
- **Distribution model:** local-first CLI (`cop1`) driving Claude Code + BMAD installations in the target project (`_bmad/`).
- **Project type (scan classification):** TypeScript pnpm monorepo — `backend` + `cli` + `library` profile. No traditional REST API, no database (persistence is file-based: YAML + JSONL + markdown). `@cop1/web` exists but is a minimal React dashboard with 2 views, not a product surface.
- **Date:** 2026-04-15 — V1-light MVP **closed on paper** as of 2026-04-14 (retro `epic-ea10-ea11-retro-2026-04-14.md`). V1.1 is scoped but uncommitted.
- **Status flag:** V1-light DoD met — "automatiser 1 epic avec transcript + step-by-step" — but the **real `commit_anchor` and real `BMADCommandRunner` are stubs** (see §10.3). The product is not yet usable for unassisted dogfooding.

## 2. Repository Shape

```
/Users/elzinko/git/bacasable/cop1
├── packages/                    # pnpm workspace — 8 packages (see §3)
│   ├── shared-kernel/           # EventBus, ports, shared types
│   ├── observability/           # StructuredLogger, LoggerBridge
│   ├── quality-intelligence/    # quality gates, drift detector
│   ├── llm-intelligence/        # LLM gateway + providers (Phase B-bound)
│   ├── sprint-core/             # BMAD orchestration, supervisor, sessions, iamthelaw (hex)
│   ├── ceremony-engine/         # ceremonies (planning, retro, grooming)
│   ├── app/                     # composition root + CLI (orchestrator, daemon, transcript)
│   └── web/                     # minimal React dashboard (rule proposals only)
├── _bmad/                       # BMAD install — READ-ONLY for cop1 (ADR-007)
│   ├── core/ bmm/ bmb/ tea/     # BMAD core workflows & tasks (never modified)
│   ├── _config/agents/*.customize.yaml  # shared cop1↔BMAD agent overrides
│   └── _memory/iamthelaw-sidecar/       # governance sidecar — cop1 writes rules.md
├── _bmad-output/
│   ├── planning-artifacts/      # PRD, architecture.md, 14 ADRs, 10 SCPs, epics, UX brief
│   └── implementation-artifacts/# stories, sprint-status.yaml (BMAD-owned), retros, sessions
├── .cop1/                       # cop1-owned runtime state (gitignored mostly)
│   ├── history/                 # Track 2 — per-exchange markdown
│   ├── metrics/                 # Track 3 — per-exchange JSONL
│   ├── rules/                   # machine YAML rules (→ synced to _bmad/_memory/...)
│   ├── audit/                   # MCP audit JSONL (planned E5-S13, not yet shipped)
│   └── sprint-log-YYYY-MM-DD.jsonl  # narrative log, append-only
├── agent/simulate-<ts>/         # disposable worktree per `sprint run --simulate` (leftover from dev)
├── docs/                        # GETTING_STARTED.md (current) + this snapshot
├── supervisor-playbook.md       # minimal playbook (see §5.2)
├── cop1.config.yaml             # runtime config — mostly pre-pivot, see §10.4
├── package.json                 # root: `pnpm build/test/typecheck/lint`, vitest + biome
├── pnpm-workspace.yaml          # `packages/*`
├── biome.json                   # lint + format
├── vitest.config.ts             # ~850 tests
├── tsconfig.base.json
├── docker-compose.yml           # Ollama + LiteLLM stack (Phase B — dormant)
├── README.md, MVP_STATUS.md, ROADMAP.md, NEXT_SPRINT.md, QUICK_START.md  # ⚠ STALE (§10.1)
└── coverage/, node_modules/
```

### Tech stack

| Layer | Tech | Version | Notes |
|---|---|---|---|
| Runtime | Node.js | ≥ 20 | native ESM (NodeNext), `.js` imports required |
| Package manager | pnpm | ≥ 9 | workspace protocol `workspace:*` |
| Language | TypeScript | ^5.7 | strict + `noUncheckedIndexedAccess` |
| Test | Vitest | ^2.1 | ~850 tests, `test:coverage` via `@vitest/coverage-v8` |
| Lint/format | Biome | ^1.9 | single-tool replacement of ESLint+Prettier |
| CLI parser | commander | ^14 | in `@cop1/app` |
| YAML | yaml | ^2.8 | |
| Schema | zod | ^4.3 | used in `sprint-core` domain |
| UI | React | ^18.3 | `@cop1/web` — vite, vitest, testing-library |
| Agent runtime | `@anthropic-ai/claude-agent-sdk` | ^0.1 | multi-turn BMAD sessions (ADR-012) |
| Local LLM | Ollama + LiteLLM | docker-compose | **dormant** — Phase A routes via Claude Code CLI instead |

## 3. Package Map (current reality)

**Dependency graph** (acyclic, bottom → top). Arrows = `@cop1/x` depends on `@cop1/y`.

```
shared-kernel  (ports, EventBus, config, types)
      ↑
observability  (StructuredLogger, LoggerBridge, events)
      ↑
llm-intelligence  (LLMGateway, LLMRouter, OllamaAdapter, ClaudeAdapter, token monitors)
      ↑
quality-intelligence  (QualityGateService, drift, coverage gate, SonarQube)
      ↑
sprint-core  (BMAD orchestration, supervisor, workflow engine, iamthelaw, agents)
      ↑
ceremony-engine  (planning, retro, grooming, round-table, scrum-master)
      ↑
app  (composition root, CLI commands, daemon, orchestrator)
      │
web  (React — consumes `@cop1/app` over HTTP if daemon is running; not wired to orchestrator)
```

Planned in `architecture.md` ADR-006 but **renamed in practice**:
- `domain` → merged into each package's `features/<f>/domain/`
- `rules-engine` → `sprint-core/src/features/iamthelaw/`
- `llm-gateway` → `llm-intelligence`
- `infrastructure` → each feature's `infrastructure/` + `bmad-orchestration`
- `api` → collapsed into `app` (CLI-first, HTTP API deferred)
- `agent-core` → never created; its responsibilities live in `sprint-core/features/workflow/` + `bmad-orchestration/`

### Per-package responsibility

| Package | Responsibility | Notable internals |
|---|---|---|
| `@cop1/shared-kernel` | Pure contracts with no IO: `EventBus` implementation, shared value types (Cop1Config via zod), LLM primitives shared across the graph, resource types. | `features/config/`, `features/events/`, `features/llm/`, `features/resources/` |
| `@cop1/observability` | Cross-cutting logging. Two features only. | `logger/` (StructuredLogger → `.cop1/sprint-log-*.jsonl`), `report/` |
| `@cop1/llm-intelligence` | LLM abstraction: provider registry, Ollama + Claude adapters, LLM router, token monitor, adaptive escalation. **Used today only by `buildLegacySteps()` — currently deprecated.** | `llm-gateway/`, `claude-adapter/`, `ollama-management/`, `provider-registry/`, `adaptive-escalation/`, `model-manager/`, `tokens-monitor/`, `mcp-registry/` |
| `@cop1/quality-intelligence` | Quality gates + drift detection used around the pipeline. | `quality-gate/`, `coverage-gate/`, `static-analysis-gate/`, `arch-drift/`, `sonarqube/`, `review-metrics/`, `retro-metrics/`, `improvement-kpi/`, `config-templates/` |
| `@cop1/sprint-core` | The heart. BMAD bridge, supervisor, workflow engine, agents (dev/reviewer/qa/pm), iamthelaw rules, budget, checkpoint, sprint session. | 37 feature folders incl. `bmad-orchestration/`, `workflow/`, `iamthelaw/`, `dev-agent/`, `reviewer-agent/`, `qa-agent/`, `pm-agent/`, `checkpoint/`, `budget/`, `story-tracker/`, `bmad-reader/`, `story-snapshot/`, `merge/`, `wsjf/`, `kpis-dashboard/`, `velocity-projector/`, `burndown/`, `dod-validator/`, `dor-validator/`, `invest-validator/`, `rule-proposal/`, `rule-auto-apply/` |
| `@cop1/ceremony-engine` | Agile ceremonies (planning, retrospective, grooming, sprint review, round-table, scrum-master, improvement review session, ceremony report, async-channel). | 9 feature folders |
| `@cop1/app` | Composition root + CLI binary `cop1`. Daemon. Orchestrator (EA10). BMAD bridge init. | `cli/` (commander), `composition/SprintRunner.ts` + `PipelineStepFactory.ts`, `features/{orchestrator,daemon,bmad-bridge,night-scheduler,ramp-up,resources,init,container-runtime,suspension,decision-history,rule-application,stories-api,blocage-api,developer-review,co-presence,async-notification,config}` (17 features) |
| `@cop1/web` | React minimal dashboard — 2 views only (`RuleProposalsView`, `ProposalCard`). Not hooked into orchestrator. | vite dev server — `pnpm dev` in package |

### Feature-first hexagonal convention

Every meaningful feature folder inside a package follows:
```
features/<feature-name>/
├── domain/          # entities, value objects, ports (pure TS, zero IO)
├── application/     # use cases / services — orchestrate ports
├── infrastructure/  # adapters implementing ports (fs, process spawn, fetch, SDK)
└── __tests__/       # co-located tests
```
(ADR-006 "Organisation Feature First Hexagonal" — applied uniformly.)

### Test footprint

`*.test.ts` lives either under `features/<f>/__tests__/` or co-located (e.g. `ProposalCard.test.tsx`). Root-level `packages/app/src/integration-tests/` hosts E2E. The reported ~850 tests pass on `pnpm test`.

## 4. Public CLI surface

Binary `cop1` — `packages/app/src/cli/index.ts:1-85`. Commander-based. The sanctioned commands today:

| Command | Handler file | Stage / Status |
|---|---|---|
| `cop1 start [--port]` | `commands/start.ts` | Daemon lifecycle |
| `cop1 stop` | `commands/stop.ts` | Daemon lifecycle |
| `cop1 status` | `commands/status.ts` | Daemon probe |
| `cop1 health [--port]` | `commands/health.ts` | JSON health info |
| `cop1 init <project-path>` | `commands/init.ts` | Project scaffolding |
| `cop1 init-bmad-bridge` | `commands/init-bmad-bridge.ts` | Wires BMAD `customize.yaml` to load iamthelaw sidecar |
| `cop1 sprint run [--dry-run] [--simulate] [--filter]` | `commands/sprint-run.ts` | **Legacy intra-command runner** — pre-EA10 |
| `cop1 sprint status` | `commands/sprint-status.ts` | Reads `sprint-status.yaml` via `BmadStatusReader` |
| `cop1 orchestrator run --epic <id> [--playbook] [--step-by-step] [--abort-on-escalation] [--project-root]` | `commands/orchestrator.ts` | **EA10 walking skeleton** — today's primary entry |
| `cop1 transcript <sessionId> [--out]` | `commands/transcript.ts` | EA11-S7 — aggregates Track 2 markdown into a readable transcript |

Exit codes for `orchestrator run`: `0` success, `2` runtime error, `3` aborted-on-escalation.

Not exposed via CLI: `@cop1/web` dashboard (needs separate `pnpm dev` in `packages/web/`). The old `/api/projects` / `/api/agents` REST endpoints documented in README/QUICK_START **no longer exist**.

## 5. Execution Flows

There are **two parallel orchestration paths** today. The EA10 `OrchestratorService` is the new inter-command driver; the `SprintRunner` is the (still wired, now legacy-warning) intra-command runner. They do not share a loop yet — the V1.1 wire-up (`BMADCommandRunner` → `SprintRunner`) is the missing bridge.

### 5.1 `cop1 orchestrator run --epic EA11` (EA10, current primary flow)

```
commands/orchestrator.ts
  └─ OrchestratorService.run(options)                           ← app/features/orchestrator/application/OrchestratorService.ts
         │
         ├─ SupervisorPlaybookLoader.load(playbookPath)         ← app/features/orchestrator/application/SupervisorPlaybookLoader.ts
         │     └─ parse markdown → SupervisorPlaybook           ← app/features/orchestrator/domain/SupervisorPlaybook.ts
         │        { version, phases[], hooks, decisionPolicy }
         │
         ├─ extractStoryKeysForEpic(sprint-status.yaml, epicId) ← read from _bmad-output/implementation-artifacts/sprint-status.yaml
         │
         ├─ for each story:
         │     for each phase.commands[]:
         │        InterCommandGate  (if --step-by-step)         ← StepByStepController (EA11-S3, in sprint-core)
         │        BMADCommandRunner({command, storyKey, epicId, projectRoot})
         │           └─ ⚠ TODAY: stub returning {success:true, nextStatus}. No real BMAD call.
         │           └─ V1.1 target: delegates to SprintRunner / BMADSessionPort per ADR-013
         │        autoDecisionLogger → .cop1/sprint-log-*.jsonl
         │        eventBus.emit('orchestrator.command.started' / 'completed')
         │        if result.escalated + mode==abort → exit code 3
         │        rewriteStoryStatus(yaml, storyKey, nextStatus) ← ⚠ cop1 writes to sprint-status.yaml here. See §10.5.
         │
         └─ return OrchestratorRunResult{ storiesProcessed[], escalated, aborted }
```

**Three tracks of persistence** (ADR-014 §8.5):
- Track 1 — SDK session state (opaque, Agent SDK owned)
- Track 2 — `.cop1/history/` per-exchange markdown (human-readable, diffable)
- Track 3 — `.cop1/metrics/` per-exchange JSONL (structured, fire-and-forget)
- Auto-decision log — `.cop1/sprint-log-YYYY-MM-DD.jsonl` (append-only narrative)

**In-process MCP tool catalog** (ADR-014 §4.2, EA10-S7) — 6 tools exposed to the supervisor LLM via `createSdkMcpServer` from Agent SDK 0.1.77. Re-entrance guard cap = 3. Tools include `commit_anchor` (⚠ stub — returns fake hash).

### 5.2 The playbook format

Minimal — markdown with frontmatter-style config lines + `## Phase name` + numbered `/bmad-bmm-*` commands. The project-root default (`supervisor-playbook.md`):

```
BMAD version: 6.0.0-Beta.8
help: /bmad-help
Epic/story restrictions: Process every story of the target epic…
Worktree hooks: managed — each story runs in its own git worktree via WorktreeService. Cleanup on success, keep on failure.
Step-by-step hooks: transition-level — inter-command pauses (EA10-S5).
Decision policy: 3-tier supervisor cascade (deterministic match → LLM answer → terminal escalation).

## Story Creation
1. /bmad-bmm-create-story

## Development Loop
1. /bmad-bmm-dev-story
2. /bmad-bmm-code-review
```

Format spec: `_bmad-output/planning-artifacts/supervisor-playbook-format.md`. Reference playbook: `supervisor-playbook-reference.md`.

### 5.3 `cop1 sprint run` (legacy — emits deprecation warning)

```
commands/sprint-run.ts
  └─ SprintRunner.run(options)                                  ← packages/app/src/composition/SprintRunner.ts
         │
         ├─ ConfigLoader.load({ skipRamValidation:true })       ← loads cop1.config.yaml
         ├─ StructuredLogger + LoggerBridge bound to EventBus
         ├─ BMADReader.listStories(projectPath)                 ← scans _bmad-output/planning-artifacts/stories
         ├─ BmadStatusReader.getAllStatuses()                   ← read-only from sprint-status.yaml (ADR-009)
         ├─ filter eligible: backlog | ready | ready-for-dev | no-status, regex-filter if --filter
         ├─ if --dry-run: return early
         ├─ if --simulate: createSimulateWorktree()             ← `git worktree add agent/simulate-<ts>`
         ├─ init services:
         │     SprintSessionService  (duration/timeout)
         │     CheckpointService     (.cop1 checkpoint)
         │     QualityGateService
         │     WorkflowEngine
         ├─ PipelineStepFactory.build(config, configLoader)     ← packages/app/src/composition/PipelineStepFactory.ts
         │     ├─ BMAD path (config.workflow.useBMAD === true):
         │     │     3 x BMADSessionStep sharing ONE AgentSdkSessionAdapter + SupervisorService (ADR-012, EA9-S5)
         │     │       commands: /bmad-bmm-dev-story, /bmad-bmm-code-review, /bmad-bmm-qa-automate
         │     └─ Legacy path (useBMAD === false):              ← ⚠ DEPRECATED EA11-S2 / 2026-04-14 — warning once per factory
         │           DevAgent(LLMCodeGenerator) → ReviewerAgent(LLMReviewer) → QAAgent() → PMAgentWorkflowStep()
         │           uses OllamaAdapter + LLMRouter(configLoader) + LLMGateway
         │           listens to 'llm.call.completed' → TokensPerSecMonitor
         │
         ├─ per story:
         │     checkpointSave(phase=AGENT_STARTED)
         │     WorkflowEngine.run(context, steps)  or .resume(...)
         │     eventBus emits 'sprint.starting', 'story.completed', 'simulate.worktree.created', 'sprint.completed'
         │
         └─ stop session, return SprintRunResult
```

⚠ **`SprintRunner` is not called by `OrchestratorService` yet.** The delegation seam (`BMADCommandRunner` callback) is defined but pointed at a stub. See §10.3.

### 5.4 Daemon (not load-bearing today)

`cop1 start` launches `daemon-entry.ts` (lives in `app/src/cli/`, not exported as a lifecycle process for the orchestrator run). `DaemonState` + `DaemonService` track a PID/port lock. Not involved in orchestrator runs — kept for future `night-scheduler`, `co-presence`, and `async-notification` features that remain unwired.

## 6. Key Architectural Seams

### 6.1 Active ports (hexagonal boundaries)

| Port (domain) | Direction | Implementations today | Source ADR |
|---|---|---|---|
| `BMADCommandPort` | cop1 → BMAD (single-shot) | `ClaudeCliAdapter` (spawns `claude -p "/bmad-bmm-..."`) | ADR-008 |
| `BMADSessionPort` | cop1 → BMAD (multi-turn) | `AgentSdkSessionAdapter` (primary, V1), `ClaudeResumeSessionAdapter` (V0 fallback, env `COP1_BMAD_ADAPTER=resume`), `InMemorySessionAdapter` (tests) | ADR-012 |
| `SupervisorLLMPort` | supervisor → LLM (question answering) | Claude-backed; deterministic lookup → LLM → escalation cascade | ADR-012 |
| `SprintStatusReaderPort` | cop1 ← `sprint-status.yaml` **read-only** | `BmadStatusReader` (prod), `InMemoryStatusReader` (tests). `YamlStatusStore` deprecated. | ADR-009 |
| `NarrativeLogPort` | cop1 → `.cop1/sprint-log-*.jsonl` | `StructuredLogger` (observability) | ADR-001 |
| `ResourceMonitorPort` | cop1 ← system (RAM/CPU) | present; gated by `skipRamValidation` in current flow | ADR-001 / NFR11 |
| `GitPort` / `WorktreeService` | cop1 → git worktrees | `WorktreeService` in `sprint-core` (EA11-S3, used by simulate mode + planned per-story worktree) | ADR-013 |
| `HistoryService` | cop1 → `.cop1/history/` | `ExchangeHistoryWriter` + `MetricsWriter` + `Reader` (EA11-S8) | ADR-014 §8.5 |
| `StepByStepController` | inter-command approval | TTY prompt / `COP1_APPROVAL_FILE` / CI no-op | ADR-013 (EA10-S5) |
| `SupervisorContext` | PRD + architecture + metadata loader | `SupervisorContextLoader` (EA11-S6) | ADR-012 (spike A3) |

### 6.2 Event topology

Single in-process `EventBus` (in `shared-kernel`). Active topics observed:
- `sprint.starting`, `sprint.resuming`, `sprint.expired`, `sprint.completed`
- `story.completed`, `simulate.worktree.{creating,created}`
- `orchestrator.run.started`, `orchestrator.story.{started,completed}`, `orchestrator.command.{started,completed}`, `orchestrator.run.completed`
- `llm.call.completed` → listened by `TokensPerSecMonitor` (legacy path)
- `mcp.call.completed` — planned for E5-S13 audit sink, not yet emitted

No cross-process bus. Daemon + CLI share in-memory EventBus when co-located; the web UI is not subscribed to it (it would require the REST + SSE layer deferred to Sprint 10+).

### 6.3 State ownership

Strict contract from ADR-007 + ADR-009:

| Path | Writer | Reader | Note |
|---|---|---|---|
| `_bmad/core/, _bmad/bmm/, _bmad/bmb/, _bmad/tea/` | **BMAD installer only** | BMAD | cop1 NEVER writes. |
| `_bmad/_config/agents/*.customize.yaml` | cop1 (`init-bmad-bridge`) + human | cop1 + BMAD | Shared governance. |
| `_bmad/_memory/iamthelaw-sidecar/rules.md` | cop1 `SidecarSyncService` | cop1 + BMAD agents | Governance bridge. |
| `_bmad-output/planning-artifacts/` | BMAD workflows | cop1 (read-only) | PRD/ADR/epics — never modified by cop1. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | BMAD (per ADR-009) | cop1 (`BmadStatusReader`) | ⚠ `OrchestratorService` currently writes to it too — see §10.5. |
| `_bmad-output/implementation-artifacts/sessions/<storyKey>-session.md` | (target) cop1 | human + cop1 | **Not yet wired** — user hack produces these manually; V1.1 gap. |
| `.cop1/rules/` | cop1 | cop1 (→ sidecar sync) | Machine YAML. |
| `.cop1/history/` | cop1 (`ExchangeHistoryWriter`) | `cop1 transcript`, human | Track 2. |
| `.cop1/metrics/` | cop1 (`MetricsWriter`, fire-and-forget) | analysis | Track 3. |
| `.cop1/sprint-log-*.jsonl` | cop1 (`StructuredLogger`, `autoDecisionLogger`) | human + tools | Narrative log. |
| `.cop1/audit/mcp-*.jsonl` | _planned_ E5-S13 sink | `cop1 audit mcp` | Not shipped. |
| `cop1.config.yaml` | human | cop1 | Config. |

## 7. LLM Pipeline — Phase A vs Phase B

**Phase A (active, since 2026-02-22 — SCP Phase-A BMAD Pivot):**
- All agent execution routes through **Claude Code CLI** via `BMADCommandPort` / `BMADSessionPort`.
- Slash-commands `/bmad-bmm-dev-story`, `/bmad-bmm-code-review`, `/bmad-bmm-qa-automate`, `/bmad-bmm-create-story` run inside the Agent SDK subprocess with `settingSources: ["project"]` so BMAD skills resolve.
- cop1 is the **Orchestrator**; BMAD is the **Executor**.
- `@cop1/llm-intelligence` (Ollama / LiteLLM / provider registry / LLM Router / adaptive escalation / model manager) is **not called in the orchestrator path**. It survives only through `buildLegacySteps()` which is deprecated and warns on use.
- ADR-005 (LLM Routing + Access Tiers — Standard/Elevated/Super Saiyan) is **SUSPENDED** (2026-02-22). Not reactivated, no replacement for tier-based access control wired.

**Phase B (not started):**
- Reintroduce local LLMs (Ollama) via `OllamaProxyAdapter` behind `BMADCommandPort`.
- Reactivate LLM Router + access tiers per ADR-005.
- Multi-LLM supervisor (V2 in ADR-012: Ollama answers simple questions).

**Dormant infra:** `docker-compose.yml` wires Ollama + LiteLLM; nothing starts it automatically. `cop1.config.yaml` still declares `llm_routing` + `llm_fallback` with `mistral:7b` defaults — unused in the orchestrator path.

## 8. ADR Inventory

| ID | Title | Status | Date |
|---|---|---|---|
| ADR-001 | Persistance d'état : YAML + JSONL derrière ports domain | ACTIVE | 2026-02-13 |
| ADR-002 | Daemon ↔ Web UI : SSE + REST | ACTIVE (deferred implementation) | 2026-02-13 |
| ADR-003 | Agent communication : file-centric + in-process callbacks | ACTIVE | 2026-02-13 |
| ADR-005 | LLM Routing + Access Tiers | **SUSPENDED** 2026-02-22 | (Phase A pivot) |
| ADR-006 | Organisation Feature First Hexagonal | ACTIVE | 2026-02-13 |
| ADR-007 | Intégration BMAD / cop1 / iamthelaw — zones de fichiers + sidecar memory | ACTIVE | 2026-02-22 |
| ADR-008 | BMAD Execution Gateway — `BMADCommandPort` Strategy (Phase A) | ACTIVE | 2026-02-22 |
| ADR-009 | `sprint-status.yaml` — BMAD source-of-truth, cop1 read-only | ACTIVE | 2026-03-08 |
| ADR-010 | iamthelaw integration consultation | ACTIVE | (planning) |
| ADR-011 | cop1 distribution + autonomous orchestration | ACTIVE | (planning) |
| ADR-012 | Multi-Turn BMAD Interaction — Agent SDK + LLM Supervisor | ACTIVE | 2026-03-19 |
| ADR-013 | Supervisor Orchestrator vs SprintRunner Separation (EA10) | ACTIVE (committed during EA11-S4) | 2026-04-07 (stub) → filled in Sprint 13 |
| ADR-014 | Supervisor Tool Interface — in-process MCP 6-tool catalog | ACTIVE (EA11-S5, 1097 lines) | Sprint 13 |

ADR-014 is the most novel piece: it describes a 3-layer architecture (pure core / SDK wrapper / future standalone) for the in-process MCP tool catalog used by the supervisor, and answers 6 design questions (Q1–Q6). This is where future V1.1 work on `commit_anchor` and session-log integration will hang.

## 9. Sprint Change Proposals (chronological)

| Date | File | Topic | Effect |
|---|---|---|---|
| 2026-02-22 | `sprint-change-proposal-2026-02-22.md` | Phase A BMAD Pivot | Suspended ADR-005; introduced ADR-007 + ADR-008; BMAD becomes executor. |
| 2026-03-09 | `sprint-change-proposal-2026-03-09.md` | (context TBC, post-EA1 retro) | |
| 2026-03-11 | `sprint-change-proposal-2026-03-11.md` | | |
| 2026-03-16 | `sprint-change-proposal-2026-03-16.md` | | |
| 2026-04-06 | `sprint-change-proposal-2026-04-06.md` | | |
| 2026-04-07 | `sprint-change-proposal-2026-04-07.md` | ADR-013 placeholder creation | Orchestrator vs SprintRunner separation decision. |
| 2026-04-11 | `sprint-change-proposal-2026-04-11.md` | EA10 restructuring | EA10 re-scoped to 9 stories. |
| 2026-04-11 | `sprint-change-proposal-2026-04-11-ea11-s8.md` | EA11-S8 addition | 3-tracks file-based refactor. |
| 2026-04-14 | `sprint-change-proposal-2026-04-14.md` | PRD-epics FR inventory sync, EA4↔EA5 dep cycle break, EA11 user value reframe, NFR26-34 mapping | Major planning-artefact alignment, zero code impact. Added E5-S13 (MCP audit). |
| 2026-04-14 | `sprint-change-proposal-2026-04-14-readiness-fixes.md` | Copy-paste patches for epics.md | Epic-level edits to match the previous SCP. |

(Full SCP contents live in `_bmad-output/planning-artifacts/` — bring them in scope before any replan.)

## 10. Drift Ledger (the interesting part)

Where the product **today** disagrees with the written artefacts, or where the artefacts disagree with each other. Ordered by severity.

### 10.1 Stale public surface docs (HIGH, trivially fixable)

The repo root-level "welcome" documents describe a product that **no longer exists**:

| File | Describes | Reality |
|---|---|---|
| `README.md` | Packages `domain / rules-engine / llm-gateway / infrastructure / api / web`, REST on `:3000`, SQLite `cop1.db`, `pnpm dev:all / dev:api / dev:web` | None of those packages exist; no REST API; no SQLite; `pnpm dev:all` is not a script (root package.json has no `dev` at all). |
| `MVP_STATUS.md` | "MVP fonctionnel" with same package names + curl examples for `POST /api/projects` etc. | Pre-Phase-A pivot. All curl examples are broken. |
| `ROADMAP.md` | Epics 1-11 with feature names like "Backlog Management Interface", "Autonomous Work Mode", "BMAD Agents Integration"… | Superseded by `_bmad-output/planning-artifacts/epics.md` (EA1..EA11 + E1..E12). |
| `NEXT_SPRINT.md` | Sprint goal "Backlog UI + Autonomous Mode prototype" with task-level TODOs on `TaskBoard.tsx`, `TaskForm.tsx`, `AutonomousMode.tsx` | Superseded years of sprints ago. Sprint 13 just closed. |
| `QUICK_START.md` | Same stale package structure + curl examples + `cop1.db` | Pre-pivot. |

`docs/GETTING_STARTED.md` is the only root-level human onboarding doc that is **accurate as of 2026-04-14**. Action (safe, obvious): delete/archive the four stale files and update `README.md` to align with `docs/GETTING_STARTED.md`. Not done in V1-light retro.

### 10.2 Planned package names vs real (MEDIUM — naming drift, but architecture is coherent)

`architecture.md` ADR-006 declares the graph `shared-kernel → observability → llm-intelligence → sprint-core → ceremony-engine → app / web`. This **matches reality**. The friction is that earlier planning (`architecture.md` §"Starter Template Evaluation") still talks about `@cop1/domain`, `@cop1/llm-gateway`, `@cop1/infrastructure`, `@cop1/agent-core` as if they existed. They were **renamed/collapsed** during the Phase A pivot:
- `domain` → dissolved into feature-local `domain/`
- `llm-gateway` → `llm-intelligence`
- `infrastructure` → feature-local `infrastructure/` + `bmad-orchestration`
- `agent-core` → never created; `sprint-core/features/workflow/` + `bmad-orchestration/` carry it

No runtime impact. But anyone reading `architecture.md` top-to-bottom hits inconsistencies. The architecture doc would benefit from a pass stripping the old names.

### 10.3 `commit_anchor` + `BMADCommandRunner` stubs (HIGH — blocks real dogfooding)

The walking skeleton advertises end-to-end orchestration, but two critical tools are hollow:

- **`BMADCommandRunner`** (`OrchestratorService.ts:34-39`): today the CLI wires a no-op that just transitions story status. No real `SprintRunner` call, no real BMAD execution. Retro D7 — MEDIUM priority carry-forward.
- **`commit_anchor` MCP tool** (EA10-S7, ADR-014 §4.2): returns a stub hash. No git commit happens per story. The retro marked this #1 V1.1 priority — without it, the user cannot run the orchestrator unattended and trust the result.
- **EA10-S9 E2E test**: closed via Plan B (local scripted fixture + `InMemorySessionAdapter`). Real BMAD execution on a real project is not yet proven. "First contact = production" risk acknowledged.

V1.1 hardening is meant to close these three. Until then, the practical workflow stays manual — which is what `docs/GETTING_STARTED.md` §"Current Interactive Workflow (Pre-V1.1)" documents.

### 10.4 `cop1.config.yaml` is pre-pivot (LOW, cosmetic)

Current content declares `llm_routing: mistral:7b` / `llm_fallback: mistral:7b` / `resources.ram_budget_night_gb: 48` / `daemon.port: 4242`. The orchestrator path ignores all of that: routing goes through Claude Code CLI, RAM check is skipped (`skipRamValidation:true` in `SprintRunner.run()`), daemon is not part of the orchestrator run. The config will be live again in Phase B (ADR-005 reactivation). Today it's a time-capsule — safe to keep, not reflective of what the code does.

### 10.5 Planning tension: ADR-009 says "cop1 read-only on `sprint-status.yaml`"; `OrchestratorService` writes to it (MEDIUM — design question)

`OrchestratorService.persistStatus()` (`OrchestratorService.ts:207-211`) does `writeFile(sprint-status.yaml, rewriteStoryStatus(...))`. ADR-009 says only BMAD writes `sprint-status.yaml`; cop1's `SprintRunner` was explicitly stripped of status-writing. But the EA10 orchestrator reintroduces writes, because the current stubbed `BMADCommandRunner` pretends to have run a BMAD command and needs to move the story forward by itself.

Once the real `BMADCommandRunner` delegates to a real BMAD `/bmad-bmm-dev-story` (which mutates the YAML itself per ADR-008), these direct writes become a double-write bug. **This is an open architectural decision** — either keep orchestrator writes as the single entry point, or push ownership back to BMAD. Not flagged in any SCP. Worth raising in the confrontation session.

### 10.6 Session log format gap vs user hack (MEDIUM — V1.1 spec)

The retro §"What Didn't Go Well §5" and §"Significant Discovery" section establish that the **user's dogfooding hack** produces a richer per-story session log (`_bmad-output/implementation-artifacts/sessions/<storyKey>-session.md`) with: entry context, shell commands + return codes, file modifications, questions verbatim + decision method, decisions with rationale, blockers + root cause, gate results, commit hash. Today's Track 2 (`.cop1/history/`) is a strict subset. V1.1 gap: extend Track 2 format + wire to story's `### Debug Log References` + `File List` + same commit. Retro HIGH priorities #2 and #3.

### 10.7 ADRs with drafted content but live dependencies

- ADR-010 (iamthelaw integration consultation) and ADR-011 (distribution + autonomous orchestration) exist as standalone files in `planning-artifacts/` but are referenced only lightly from `architecture.md`. Their decisions are in flight — `iamthelaw` code exists in `sprint-core/features/iamthelaw/` but the consultation flow (ADR-010's subject) is partially built.
- ADR-013 was created as a **stub 2026-04-07** and only fully filled during EA11-S4 (Sprint 13). The 525-line final version is post-decision; anyone reading the earlier version sees placeholders.
- ADR-014 is the most recent and most novel — 1097 lines describing the in-process MCP 3-layer architecture. It supports `commit_anchor`, `consult_agent`, `synthesize_decision`, etc. Validated in EA10-S7 via Task 0 spike. User may want an architect session on it (retro §Open Questions #4).

### 10.8 Orphan artefacts in the repo

- `agent/simulate-1775509624883/` — a leftover `git worktree add` from a `sprint run --simulate` invocation; not cleaned up. Safe to remove or gitignore.
- `coverage/` — vitest coverage output; should be gitignored.
- `_bmad-output/brainstorming/` + `_bmad-output/test-artifacts/` + `_bmad-output/bmb-creations/` — present but not discussed in canonical docs; likely tooling output.
- `_bmad-output/planning-artifacts/historical/` — explicit archive of superseded docs (healthy).

## 11. Build, Test, Run

### Prerequisites
- Node ≥ 20, pnpm ≥ 9, Git.
- For real orchestrator runs: BMAD installed in the target project (`_bmad/`) + Claude Code CLI in PATH.

### Scripts (root `package.json`)

```bash
pnpm install
pnpm build        # tsc -b across 7 compiled packages (web built separately)
pnpm typecheck    # tsc -b --noEmit, strict mode
pnpm test         # vitest run — ~850 tests
pnpm test:watch
pnpm test:coverage
pnpm lint         # biome check .
pnpm lint:fix
pnpm format
pnpm clean        # pnpm -r clean && rm -rf node_modules
```

### Running the orchestrator (V1-light)

```bash
# Normal mode
node packages/app/dist/cli/daemon-entry.js orchestrator run --epic EA11

# Step-by-step (TTY prompt or COP1_APPROVAL_FILE)
node packages/app/dist/cli/daemon-entry.js orchestrator run --epic EA11 --step-by-step

# Abort on escalation
node packages/app/dist/cli/daemon-entry.js orchestrator run --epic EA11 --abort-on-escalation

# Inspect outputs
ls .cop1/history/               # Track 2
ls .cop1/metrics/               # Track 3
cat .cop1/sprint-log-*.jsonl    # narrative + auto-decision log
node packages/app/dist/cli/daemon-entry.js transcript <session-id>
```

Exit codes: `0` success, `2` runtime error, `3` aborted-on-escalation.

### Running the legacy pipeline (for comparison only)

```bash
# EMITS deprecation warning once per factory instance
cop1 sprint run --dry-run
cop1 sprint run --simulate --filter 'EA11-*'
```

Enable/disable BMAD path via `config.workflow.useBMAD` in `cop1.config.yaml` (true = `BMADSessionStep` pipeline, false = deprecated legacy).

## 12. Observations for the Architecture Confrontation

Quick starter list — not a prescription, just what this snapshot surfaces that a session could dig into.

1. **Two parallel orchestrators (EA10 `OrchestratorService` + `SprintRunner`) without a wired seam.** The ADR-013 delegation contract (`BMADCommandRunner` → `SprintRunner`) is declared but stubbed. Does V1.1 really need two layers, or does the hack pattern suggest merging them?
2. **`sprint-status.yaml` double-writer risk (§10.5).** ADR-009 vs EA10 reality. Pick one owner before V1.1 wires real BMAD execution.
3. **The MCP in-process tool catalog (ADR-014) is novel and load-bearing.** Is the 3-layer architecture (pure core / SDK wrapper / future standalone) the right shape, or does the user dogfooding gap list point at a simpler path?
4. **Session log is a product gap, not a feature.** Track 2 vs user hack output (§10.6). Confrontation question: do we extend the Track 2 format, adopt the hack format verbatim, or build a new `SessionJournalService`?
5. **LLM tier reactivation (Phase B, ADR-005).** Off the roadmap since 2026-02-22. Does the V1.1 horizon still assume Phase B as next, or has the need shifted?
6. **`iamthelaw` has code in `sprint-core/features/iamthelaw/` but its consultation flow (ADR-010) is partial.** Is the governance sidecar (per-agent rules + retro-to-rules loop EA4↔EA5) still the plan, or has the Phase-A pivot made it vestigial?
7. **`@cop1/web` is dormant.** FR125/126/129/135/139 re-tagged Sprint 10+ per SCP 2026-04-14. Confrontation question: is a web UI still part of the minimum viable dogfooding experience, or is CLI sufficient for the solo-dev persona?
8. **Distribution story (EA8, ADR-011).** CLI is local-first; there is no packaged install for a target project. `cop1 init <project-path>` scaffolds but does not publish. Does the product need a `pnpm dlx cop1` path before heavy dogfooding?
9. **`agent-core` was never built.** Its would-be responsibilities (workflow engine + agent lifecycle + checkpoint) live in `sprint-core`. Does `sprint-core` want a split now that EA10 added orchestrator state on top of it? (Retro D8: `SessionTranscriptGenerator` in `sprint-core` already flagged as circular-dep workaround.)
10. **Plan B fixtures for E2E (R9 rule candidate).** Retro institutionalises it as process. Worth deciding whether Plan B patterns are acceptable long-term or a debt to pay down in EA6.

## 13. Reading Order for the Next Session

When you come back, read these in this order (fastest path to being ready to challenge the architecture):

1. This snapshot (top to bottom).
2. `docs/GETTING_STARTED.md` — current user-facing contract.
3. `_bmad-output/implementation-artifacts/epic-ea10-ea11-retro-2026-04-14.md` — most recent signal from reality.
4. `_bmad-output/planning-artifacts/adr-013-orchestrator-sprintrunner-separation.md` — the active seam.
5. `_bmad-output/planning-artifacts/adr-014-supervisor-tool-interface.md` — the novel piece.
6. `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-14.md` — last planning alignment.
7. `_bmad-output/planning-artifacts/architecture.md` §ADR-006..014 only (skip earlier ADRs unless digging into a specific question).
8. `_bmad-output/planning-artifacts/prd.md` §Executive Summary + §MVP capacity tables only (the rest is historical).

Everything else (README, MVP_STATUS, ROADMAP, NEXT_SPRINT, QUICK_START) — don't read until we've agreed they're archived.

---

_End of snapshot — 2026-04-15._
