# Controlled Tiered Overnight Run — Design Report

> Généré le 2026-06-20 par le workflow `cop1-controlled-run-design` (version collapse-safe, 7 agents).
> Checkout analysé : worktree `zen-gauss-49a61e` (branche `claude/zen-gauss-49a61e`).
> Objectif : run de nuit autonome et contrôlé, tiering gros-LLM (Claude SDK) / LLM local (Ollama), façon boucle Ralph.

---

## 1. Synthèse (rapport décisionnel)

## Features in place — crisp bullets: what works today in the run path

- **Single-command epic driver.** `cop1 orchestrator run --epic <id>` (`packages/app/src/cli/commands/orchestrator.ts`, registered in `cli/index.ts`) is the live entrypoint: it loads the supervisor playbook, runs an `_bmad/` pre-flight guard, builds the real runner, and drives `OrchestratorService.run()`.
- **Inter-command loop over stories × phases.** `OrchestratorService` (`packages/app/src/features/orchestrator/application/OrchestratorService.ts`) reads stories from `_bmad-output/.../sprint-status.yaml`, iterates playbook phases (falling back to `BmadCycle.defaultCommandsForPhase` in `packages/sprint-core/src/features/bmad-orchestration/domain/BmadCycle.ts`), and runs one `(story, command)` per iteration.
- **Fresh-context-per-iteration discipline.** `DefaultBMADCommandRunner` (`packages/app/src/features/orchestrator/infrastructure/DefaultBMADCommandRunner.ts`) starts exactly one `BMADSessionPort` session per `(story, command)` and drains the `SessionInteractionCollector` between commands — Ralph's "fresh context, pick one task" skeleton is genuinely wired.
- **Real agentic BMAD sessions via the Claude Agent SDK.** `AgentSdkSessionAdapter` (`packages/sprint-core/src/features/bmad-orchestration/infrastructure/AgentSdkSessionAdapter.ts`) lazy-loads `@anthropic-ai/claude-agent-sdk` `query()`, runs BMAD commands as agentic sessions with the `claude_code` preset + `settingSources: ['project']`, and intercepts `AskUserQuestion` via `canUseTool`.
- **Autonomous question answering / escalation.** `SupervisorService` + `AgentSdkSupervisorAdapter` (`packages/sprint-core`) answer intercepted BMAD questions through deterministic patterns → LLM supervisor → escalation, so a session does not block on a prompt overnight (it either answers or escalates).
- **3-track history + observability, all wired.** sprint-status.yaml ledger (`OrchestratorService.persistStatus` + `YamlSprintStatusAdapter`), JSONL auto-decision log (`autoDecisionLogger` → `.cop1/sprint-log-DATE.jsonl`), and Track-2 markdown exchange records (`ExchangeHistoryWriter`, wired EA14-S2). `EventBus` (`packages/shared-kernel`) + `StructuredLogger` emit/persist lifecycle events.
- **Pre-flight safety guard.** The `_bmad/` bundle-detection guard (EA14-S1) aborts the run before building the real runner if the BMAD install is missing.
- **Step-by-step manual gate.** `InterCommandApprovalResolver` + `StepByStepController` pause between commands for continue/skip/abort via TTY or `COP1_APPROVAL_FILE` when `--step-by-step` is set.
- **Escalation/abort mode.** `OrchestratorService` supports `abort-on-escalation`: it marks the story blocked and breaks the loop.
- **Human-readable transcript generation.** `SessionTranscriptGenerator` + `ExchangeHistoryReader` build a markdown transcript from Track-2 files, surfaced via `cop1 transcript`.

## Features partial or dormant

- **SDK-native budget cap — present but unpopulated.** `AgentSdkSessionAdapter` accepts `Options.maxBudgetUsd` and forwards it to the SDK (line 149), and supports `maxTurns` (default 30), but `orchestrator.ts` (line 138) constructs the adapter with only `{ questionHandler }` — so the per-session cost cap is **off** in the live path.
- **Worktree isolation — exists, mis-wired.** `WorktreeService` / `WorktreeManager` (`packages/sprint-core/src/features/dev-agent`) create/cleanup/list via `git worktree`, but are wired only to the **legacy** `DevAgent`, not to the live orchestrator runner — which runs every story in the shared `projectRoot`.
- **Checkpoint/suspend primitives — exist, unwired into the live loop.** `CheckpointService` (atomic `.cop1/checkpoint.yaml`) + `SuspensionService` are consumed by `SprintRunner`/`WorkflowEngine` (the legacy `sprint run` path) but **not** by `OrchestratorService`; live recovery relies on re-running and skipping already-done stories.
- **Iteration limiter — exists, unwired.** `IterationLimiter` throws after N iterations but is not in the orchestrator loop (the loop instead uses `MAX_FOLLOWUP_TURNS=3` inside `DefaultBMADCommandRunner`).
- **Token budget tracker — dormant on the live path.** `TokenBudgetService` + `YamlBudgetStore` track per-day/agent/model spend, but are never constructed in the live path and subscribe to `llm.call.completed`, which only the legacy `LLMGateway`/`ClaudeCliAdapter` emit — `AgentSdkSessionAdapter` emits `session.*`, so the budget service would see zero consumption even if built.
- **Daemon + night-scheduler — present, not connected to the run.** `DaemonService` exposes `/health` and `/api/sprint/status` but never spawns or controls the orchestrator; `NightSchedulerService` has pure `shouldStart`/`getNextScheduled` logic but **zero callers** — nothing fires the run on schedule.
- **Session recovery primitives — partial.** `restoreSession` on the adapter (EA12-S2) and `MetricsWriter`/`SessionHistoryReader` exist, but no run-path caller invokes recovery.
- **Legacy `sprint run` path — superseded.** `SprintRunner` → `PipelineStepFactory.buildBMADSteps()` → `WorkflowEngine` over `BMADSessionStep`, with `BMADReader`/`CheckpointService`/worktree, still wired but superseded by EA10; its `QualityGateService` is constructed with an **empty** gates array, so no gate runs.
- **Supervisor context loaders — dormant.** `SupervisorContextLoader` / `SupervisorPromptBuilder` and `iamthelaw` rule-loading exist, but `DefaultBMADCommandRunner` passes empty `architectureRules`/`iamtheLawRules`.
- **The entire tiering/routing stack — dormant behind a deprecated flag.** `LLMRouter`, `LLMGateway`, `OllamaAdapter`, `AdaptiveLLMService`, `LLMProviderRegistry`, `ModelManager` (`packages/llm-intelligence`) are reachable **only** from `PipelineStepFactory.buildLegacySteps()` (the deprecated `useBMAD=false` arm). `config.llm_routing` / `llm_fallback` exist in `Cop1Config` but are inert in the BMAD path.

## Features missing

- **Budget/spend enforcement on the live path.** No spend ceiling exists: `maxBudgetUsd` is never passed and `TokenBudgetService` is never fed. An overnight run has no hard stop.
- **Real verification gate.** `inferNextStatus()` in `DefaultBMADCommandRunner` maps command name → status with zero checks — no test/lint/build/git verification anywhere in the runner. "Done" is asserted, not proven (the single most un-Ralph gap).
- **Auto-commit of verified per-story work.** The runner writes files via the SDK session but never `git add`/`commit`, so overnight output is uncommitted and can be lost or entangled.
- **Non-interactive kill-switch / external abort.** Abort is only cooperative (step-by-step token / escalation mode); the orchestrator is a foreground process that the daemon's SIGTERM cannot reach.
- **Per-story git-worktree isolation in the live loop** (machinery exists, just unwired — see above).
- **Crash resumability for the orchestrator loop** (`CheckpointService` unwired into `OrchestratorService`).
- **An unattended night driver** that actually launches the run on schedule (`NightSchedulerService` has no caller; the daemon never invokes the orchestrator).
- **Model tiering on the live path.** `AgentSdkSessionAdapter` sets no `Options.model`; every command runs the SDK default — no Opus/Sonnet-by-command, and no local tier at all.
- **Live-path token accounting feeding the budget** (the SDK adapter emits no `llm.call.completed`).
- **Per-story retry/iteration ceiling, health/heartbeat watchdog, and alerting for a stuck run.**
- **A running local tier.** `docker-compose.yml` has the `ollama` service commented out; `ModelManager.activate()` is never called — nothing listens on `localhost:11434`.

## Blockers

| Problem | Impact | Severity |
|---|---|---|
| No budget/USD-or-token cap enforced on the live path (`maxBudgetUsd` never passed; `TokenBudgetService` never built and fed by a no-op event) | An unattended overnight run can burn unbounded spend; the user's headline "controlled" requirement is unmet | blocker |
| No real verification gate before marking a story done (`inferNextStatus()` string-maps command→status) | "Done" is fiction; broken code compounds across fresh-context iterations and is never caught | blocker |
| No non-interactive kill-switch / external abort reachable while the loop runs | A misbehaving or runaway run cannot be stopped without killing the process; no safe overnight posture | blocker |
| Live SDK adapter emits `session.*`, not `llm.call.completed`, so even a wired budget service sees zero consumption | Token accounting and budget-kill are structurally disconnected from the live executor | blocker |
| No auto-commit of verified per-story work in the live runner | Overnight output is uncommitted, un-anchored, and can be lost or entangled across stories | high |
| No per-story git-worktree isolation in the live loop (`WorktreeManager` wired only to legacy `DevAgent`) | All stories mutate one shared tree; no rollback unit; cannot parallelize safely | high |
| No crash resumability (`CheckpointService` unwired into `OrchestratorService`) | A crash mid-night loses in-flight progress beyond what sprint-status.yaml records | high |
| No unattended night driver (`NightSchedulerService` has zero callers; daemon never starts the run) | Nothing actually launches the run overnight; "overnight" is manual today | high |
| Tiering config keys (`llm_routing`/`llm_fallback`) are live in `Cop1Config` but inert in the BMAD path | A user filling them in gets a silent no-op — false confidence | medium |
| Local tier runtime not provisioned (`ollama` service commented out; `ModelManager.activate()` never called) | Any local-routed phase fails instantly with `LLMUnavailableError` | medium |
| Local model cannot run BMAD natively (BMAD = Claude Code skills loaded via `settingSources`; Ollama has no skill/tool harness) | A naive "send dev-story to Ollama" breaks unless routed through the SDK→LiteLLM loop or a purpose-built executor | medium |
| Supervisor model is a third, separate, uncapped decision (`AgentSdkSupervisorAdapter` sets no model) | Even within "big", supervisor cost is un-tuned overnight | low |
| No health/heartbeat watchdog for a session hung under `maxTurns=30` | A stalled session can idle silently until morning | low |

## Target design — the recommended target design for a controlled tiered overnight run

The target is a **Ralph-style loop that cop1 already half-implements**, hardened with the four missing trust mechanisms (verify, commit, budget-kill, isolation) and given a tiered model topology that respects the one hard architectural fact below.

### The loop

Keep `OrchestratorService.run()` as the iteration engine — it already does fresh-context-per-`(story, command)` and a sprint-status.yaml ledger, which is the Ralph skeleton. Per iteration, the contract becomes **select-one → route-tier → execute → verify → commit (anchor) → mark-done → log**, bounded by a two-level stop condition (an agent-level "all stories done" signal plus a loop-level iteration cap and a budget cap). The verify-then-commit half is the new work; everything before it exists.

### Tiering topology — and the honest verdict on "inside the SDK or separate executor"

**The load-bearing fact:** when cop1 drives BMAD *through* the Claude Agent SDK, the agent loop itself is the LLM. Setting the SDK `model` option to a smaller Anthropic model gives you Opus/Sonnet/Haiku tiering but stays inside Anthropic — it does **not** reach Ollama. So "local tier" is not a `model` string change against the default endpoint.

**The verdict — the simple tier CAN run inside the Claude Agent SDK.** The SDK is the Claude Code agent loop as a library and it honors `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN`. Point it at a **LiteLLM proxy** whose unified Anthropic `/v1/messages` endpoint is mapped to `ollama_chat/<model>`, and the SDK's own tool loop runs on the local model. The loop closes: SDK → Anthropic-format request → LiteLLM translates → Ollama `/api/chat` → back to the SDK. **A separate local executor is therefore NOT architecturally required** for the happy path, and this is the pragmatic recommendation: one orchestration surface, tier chosen purely by the `model` string cop1 passes per `(story, command)`.

The honest caveat that shapes the design: local 7-8B models produce flakier tool calls (LiteLLM falls back to JSON-mode tool calls when native tool-calling is absent), so the local tier must be **gated to genuinely simple, verifiable phases and always run through the verify-gate, with automatic escalation to big-Claude on failure.** Keep a **separate local executor (aider/opencode/direct-Ollama returning a diff for big-Claude review) as a documented fallback**, chosen empirically per model/hardware — not built now.

Concrete topology: one LiteLLM proxy on `localhost:4000` fronting both Ollama (model name `local-coder` → `ollama_chat/qwen2.5-coder`) and the big tier (`big-claude` → Opus, `review-claude` → Sonnet). cop1 sets `ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN` once and selects per phase.

```yaml
# litellm config.yaml (sketch)
model_list:
  - { model_name: big-claude,    litellm_params: { model: anthropic/claude-opus-4-8,   api_key: os.environ/ANTHROPIC_API_KEY } }
  - { model_name: review-claude, litellm_params: { model: anthropic/claude-sonnet-4-6, api_key: os.environ/ANTHROPIC_API_KEY } }
  - { model_name: local-coder,   litellm_params: { model: ollama_chat/qwen2.5-coder:7b, api_base: http://localhost:11434, keep_alive: "8m" },
      model_info: { supports_function_calling: true } }
litellm_settings:
  fallbacks: [{ "local-coder": ["review-claude"] }]   # gateway-level escalation
```

### Where routing decides — name the seam

The per-`(story, command)` routing decision belongs in **`DefaultBMADCommandRunner` / `createDefaultBMADCommandRunner`** — specifically the returned runner closure `async ({ command, storyKey, epicId, projectRoot }) => …` in `packages/app/src/features/orchestrator/infrastructure/DefaultBMADCommandRunner.ts`. This is the one place per tuple where cop1 decides who executes a phase. Add a policy `routeModel(command, story) → 'big-claude' | 'review-claude' | 'local-coder'`:

- `/bmad-bmm-create-story`, architecture/spec workflows, `/bmad-bmm-code-review` → big/review.
- `/bmad-bmm-dev-story`, `/bmad-bmm-qa-automate` → eligible for `local-coder`, gated by a story-complexity signal (story points / file-count / a YAML front-matter label).

The chosen model string is threaded down to the executor via a new model field on `BMADSessionPort.startSession(command, context)` / `BMADSessionContext` (currently carries `projectPath`/`storyId`/`metadata`, no model), and into `AgentSdkSessionAdapter.executeQuery`'s `Options` block (`AgentSdkSessionAdapter.ts:143-158`) where `model` is added:

```ts
const options: Options = {
  systemPrompt: { type: 'preset', preset: 'claude_code' },
  ...(resolvedModel && { model: resolvedModel }),   // routing plugs in here
  ...(this.maxBudgetUsd !== undefined && { maxBudgetUsd: this.maxBudgetUsd }),
  maxTurns: this.maxTurns,
  ...
};
```

This is a textbook dependency-inversion point: `OrchestratorService` already depends on the `BMADCommandRunner` abstraction, so adding a router behind that runner does not ripple upward.

### Isolation

Per-epic (V1) and per-story (V1.1) **git worktree + branch** named `cop1/<epic>` or `cop1/<story>`, wiring the **already-present `WorktreeManager`** (`packages/sprint-core/src/features/dev-agent/infrastructure/WorktreeManager.ts`) into `DefaultBMADCommandRunner`/`OrchestratorService` and passing the worktree path as the SDK session `cwd` (the adapter already supports `context.projectPath → cwd`). Symlink heavy gitignored dirs (`node_modules`) into each worktree to keep spin-up cheap. For untrusted/overnight blast-radius containment, the dormant `DockerDesktopAdapter` / `ContainerRuntimePort` is the escalation rung (later, not V1).

### Budget / kill controls

Two independent rails:

1. **Per-session SDK cap (immediate, cheap):** populate `maxBudgetUsd` in `orchestrator.ts` (line 138) where the adapter is constructed — already plumbed, just unset. Big-tier only (local calls are free).
2. **Loop-level budget-kill + external abort:** feed `TokenBudgetService` from the live path by emitting `llm.call.completed`-equivalent accounting from `AgentSdkSessionAdapter` (it currently emits `session.*` only — this is the structural disconnect to fix), and have `OrchestratorService` check the accumulated spend between iterations and hard-stop when the ceiling is hit. Add a **non-interactive kill-switch**: a watched abort file (reuse the `COP1_APPROVAL_FILE` mechanism) or a daemon endpoint that the loop polls between iterations, so an operator can stop an overnight run without killing the process. Pair with an **iteration cap** (wire the dormant `IterationLimiter`) as the first-line budget control.

### Commit anchoring

After the verify-gate passes for a story, the runner must `git add -A && git commit` on the worktree branch with a deterministic message (`feat: <storyKey> - <title>`) — a single explicit **commit-anchor** step, currently entirely absent from the live runner. Surface it as an in-process MCP tool (`commit_anchor`) attached to the session via `createSdkMcpServer` + `mcpServers` (the supervisor-architecture ADR-014 vision), with `allowedTools` extended to include the MCP tool name, OR — simpler for V1 — perform the commit directly in `DefaultBMADCommandRunner` after `inferNextStatus()` is replaced by a real gate. The commit is the rollback unit and the merge-back anchor (`uzi checkpoint` / `cu merge` analog: rebase/merge the worktree branch preserving history).

## Sequenced plan

| Step | Rationale | Effort |
|---|---|---|
| 1. Wire `maxBudgetUsd` (and confirm `maxTurns`) into the live adapter construction in `orchestrator.ts:138` | Cheapest possible spend ceiling; the plumbing already exists in `AgentSdkSessionAdapter`. Turns one blocker into a partial mitigation immediately | S |
| 2. Replace `inferNextStatus()` with a real verify-gate (tests + lint + build via the project's local CI) before any status advance, using the `local-ci-validation` discipline | The load-bearing trust mechanism; without it every later step anchors fiction. Blocker | M |
| 3. Add the commit-anchor step in `DefaultBMADCommandRunner` after the gate passes (`git add -A && git commit feat:<storyKey>`) | Makes overnight output durable, rollback-able, and mergeable; pairs with the gate | S |
| 4. Emit live-path token/cost accounting from `AgentSdkSessionAdapter` and construct + subscribe `TokenBudgetService`; add a loop-level budget check + hard stop in `OrchestratorService` | Closes the structural disconnect (SDK emits `session.*`, budget listens for `llm.call.completed`); arms the real budget-kill. Blocker | M |
| 5. Add a non-interactive kill-switch (watched abort file or daemon-polled flag checked between iterations) + wire `IterationLimiter` as the loop ceiling | External abort + iteration cap make unattended operation safe. Blocker | M |
| 6. Wire `WorktreeManager` into the live loop (per-epic branch, worktree path as SDK `cwd`, symlink node_modules) | Isolation + rollback unit; prerequisite for any parallelism and for clean commit anchoring | M |
| 7. Stand up the local tier infra: uncomment/launch Ollama, pull a tool-capable coder model via `ModelManager`, run a pinned-version LiteLLM proxy with the `big/review/local` `model_list` | Provisions `localhost:11434` + `localhost:4000` so a local-routed phase doesn't instantly fail. Pin LiteLLM to a known-good version (avoid 1.82.7/1.82.8) | M |
| 8. Thread a `model` field through `BMADSessionPort`/`BMADSessionContext` → `AgentSdkSessionAdapter` Options, and set `ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN` to the LiteLLM proxy | The minimal change that lets cop1 select a model per phase, including the local one, inside the SDK | S |
| 9. Add `routeModel(command, story)` policy in `DefaultBMADCommandRunner`'s runner closure (review/spec/arch → big; dev-story/qa-automate → local, gated by complexity) + auto-escalate to big on N verify-gate failures (reuse `AdaptiveLLMService` shape) | The actual tiering decision at the right seam, with the safety escalation that bounds local-model flakiness | M |
| 10. Wire `CheckpointService` into `OrchestratorService` for crash-resume | Lets an interrupted night run resume mid-epic rather than re-deriving from sprint-status.yaml | M |
| 11. Wire the night driver: have `NightSchedulerService` (or a cron-bound daemon command) launch `orchestrator run` on schedule against a pinned playbook snapshot | Makes the run genuinely unattended/overnight; pin the playbook at schedule-creation for reproducibility | M |
| 12. Add a heartbeat/watchdog + alert on stuck session or token drift | Detects a hung `maxTurns=30` session before morning; matches cop1's "alert on drift" posture | S |

Minimal path to the *first* controlled tiered overnight run: steps 1-9 (trust rails + a working local tier behind the right seam). Steps 10-12 harden it from "works once, watched" to "runs unattended, resumable, observable."

## Design-principles note

The target design deliberately changes wiring, not architecture — the hexagonal ports cop1 already has are exactly the seams this plan exploits, which is the strongest evidence the existing design was sound.

**Hexagonal ports already present.** `BMADSessionPort` is the port; `AgentSdkSessionAdapter`, `ClaudeResumeSessionAdapter`, and (future) a LiteLLM-pointed adapter are interchangeable driven adapters. Routing big-vs-local is implemented by *selecting* an adapter/model behind that port, not by leaking provider knowledge into `OrchestratorService`. `ContainerRuntimePort`, `ContainerRuntimePort`'s `DockerDesktopAdapter`, and `BMADSessionContext` are the isolation ports the worktree/container work plugs into. The budget and verify rails attach at `EventBus` and the runner abstraction — domain-level ports that already exist.

**Dependency inversion for the executor/model router.** `OrchestratorService` depends on the `BMADCommandRunner` abstraction; `DefaultBMADCommandRunner` depends on the `BMADSessionPort` abstraction. The model router (`routeModel(command, story)`) and the tier escalation are injected behind those abstractions, so the high-level loop never imports `@cop1/llm-intelligence` or knows that "local" means Ollama-via-LiteLLM. The model string is data threaded through the port, not a branch in the orchestrator — inversion preserved end to end.

**SOLID.** *Single responsibility:* the router decides tier, the runner drives one phase, the gate verifies, the commit-anchor persists — each new concern is its own collaborator, not a fattened `OrchestratorService`. *Open/closed:* adding the local tier extends the system by adding a model mapping + adapter behind the existing port rather than modifying the loop. *Liskov/interface segregation:* a LiteLLM-pointed SDK session is substitutable for the Anthropic-pointed one because both honor the same `BMADSessionPort` contract (same `query()` agentic loop). *Dependency inversion:* as above.

**No premature method abstraction.** This is explicit and load-bearing: **BMAD stays the one and only method, behind the existing `BMADCommandRunner` / `BMADSessionPort` seam.** The plan does **not** introduce a method-agnostic "workflow engine abstraction," does not generalize BMAD commands into a neutral DSL, and does not build the three-tier ADR-005 grant/revoke machinery (PM-approval, temporary `LLMAccessGrant.expiresAt`). The tiering ask is implemented as the *simplest* thing that satisfies it — a static per-command routing table collapsing ADR-005's Standard→"local" and Elevated/Super-Saiyan→"big", plus the one dynamic piece worth keeping (failure→escalate). Abstracting "the method" or rebuilding ADR-005's full tier system now would be speculative generality; the seams already in place make it a cheap change to introduce later if a second method ever appears. The discipline is: harden the run path that exists, route at the seam that exists, and let the dormant-but-correctly-shaped components (`WorktreeManager`, `TokenBudgetService`, `IterationLimiter`, `AdaptiveLLMService`, `LLMRouter`) be *wired in*, not redesigned.

---

## Annexe A — Inventaire des features (55 capabilities)

**Run-path summary.** The live `cop1 orchestrator run` path (the EA10+ real path) is: cli/index.ts registers `orchestrator run` -> packages/app/src/cli/commands/orchestrator.ts loads supervisor-playbook.md (SupervisorPlaybookLoader), runs an _bmad/ pre-flight guard, and builds the real runner via createDefaultBMADCommandRunner (DefaultBMADCommandRunner.ts) wiring AgentSdkSessionAdapter + SupervisorService + AgentSdkSupervisorAdapter + SessionInteractionCollector + ExchangeHistoryWriter; OrchestratorService.ts then reads stories from _bmad-output/.../sprint-status.yaml, iterates playbook phases (falling back to BmadCycle.defaultCommandsForPhase), and for each (story,command) calls the runner which drives a real claude-agent-sdk session, auto-answering/escalating questions through SupervisorService, persisting status back into the yaml and mirroring it into story bodies, emitting EventBus events, JSONL auto-decision logs, and Track-2 markdown exchange records. A second, older and now-superseded path exists under `cop1 sprint run` (SprintRunner.ts -> PipelineStepFactory -> WorkflowEngine over BMADSessionStep, with checkpoint/worktree/BMADReader), and its quality gate is constructed empty so no gate actually executes. Everything else — the entire ceremony-engine, most sprint-core services (validators, budget, blocage, rule lifecycle, improvement loop, reporting), all quality sub-gates and metrics, the LLM extras, the daemon's rules-API/SSE, the React web app, night-scheduler, container-runtime, and ~10 app API stub features — is dormant barrel-only scaffolding, with the legacy useBMAD=false Ollama agent pipeline explicitly deprecated for removal.

| Capability | Package | Status | What it does | Evidence |
|---|---|---|---|---|
| Orchestrator CLI command | @cop1/app | wired-in-run-path | `cop1 orchestrator run --epic` entrypoint: loads playbook, picks runner, drives OrchestratorService | packages/app/src/cli/commands/orchestrator.ts; registered in cli/index.ts as `orchestrator run` |
| OrchestratorService (inter-command loop) | @cop1/app | wired-in-run-path | Reads epic stories from sprint-status.yaml, runs command sequence per story, persists transitions, emits events | packages/app/src/features/orchestrator/application/OrchestratorService.ts; invoked by orchestrator.ts svc.run() |
| DefaultBMADCommandRunner | @cop1/app | wired-in-run-path | Per (story,command) drives a real BMAD session via BMADSessionPort, routes questions to supervisor, writes Track-2 history | packages/app/src/features/orchestrator/infrastructure/DefaultBMADCommandRunner.ts; built in orchestrator.ts resolveRunner() |
| AgentSdkSessionAdapter (BMAD session) | @cop1/sprint-core | wired-in-run-path | Lazy-loads @anthropic-ai/claude-agent-sdk query(), runs BMAD commands as agentic sessions, intercepts AskUserQuestion | packages/sprint-core/src/features/bmad-orchestration/infrastructure/AgentSdkSessionAdapter.ts; default sessionPort in orchestrator.ts |
| SupervisorService | @cop1/sprint-core | wired-in-run-path | Answers intercepted BMAD questions: deterministic patterns -> LLM supervisor -> escalation | SupervisorService.ts; createQuestionHandler() wired into session adapter in orchestrator.ts |
| AgentSdkSupervisorAdapter | @cop1/sprint-core | wired-in-run-path | SDK-backed LLM port that answers supervisor questions for complex prompts | infrastructure/AgentSdkSupervisorAdapter.ts; constructed in orchestrator.ts and sprint-run.ts |
| SessionInteractionCollector / SessionLogger | @cop1/sprint-core | wired-in-run-path | Captures supervisor/agent interactions during a session for Track-2 exchange history | application/SessionInteractionCollector.ts; instantiated in orchestrator.ts resolveRunner() |
| ExchangeHistoryWriter (Track 2) | @cop1/sprint-core | wired-in-run-path | Writes per-session markdown exchange records with front-matter after each command | infrastructure/ExchangeHistoryWriter.ts; wired into DefaultBMADCommandRunner via orchestrator.ts (EA14-S2) |
| SupervisorPlaybookLoader | @cop1/app | wired-in-run-path | Parses supervisor-playbook.md into phases/commands consumed by OrchestratorService | features/orchestrator/application/SupervisorPlaybookLoader.ts; loaded at top of orchestrator.ts |
| BmadCycle defaults (defaultCommandsForPhase) | @cop1/sprint-core | wired-in-run-path | Canonical command cycle fallback when playbook omits per-phase commands | domain/BmadCycle.ts; called in OrchestratorService.run() phase loop |
| InterCommandApprovalResolver / step-by-step gate | @cop1/app | wired-in-run-path | Pauses between commands for manual continue/skip/abort when --step-by-step | infrastructure/InterCommandApprovalResolver.ts; gate passed into OrchestratorService in orchestrator.ts |
| BMAD bundle pre-flight guard | @cop1/app | wired-in-run-path | Aborts run if _bmad/ install is missing before building real runner (EA14-S1) | orchestrator.ts resolveRunner() existsSync(_bmad) check |
| StubBMADCommandRunner | @cop1/app | partial | Fake-success runner behind --runner stub + COP1_ALLOW_STUB_RUNNER=1, for tests/smoke only | infrastructure/testing/StubBMADCommandRunner.ts; gated escape hatch in orchestrator.ts, not real path |
| ClaudeResumeSessionAdapter (fallback) | @cop1/sprint-core | partial | Opt-in fallback that spawns `claude --resume` per turn when COP1_BMAD_ADAPTER=resume | infrastructure/ClaudeResumeSessionAdapter.ts; selected via env var in orchestrator.ts/sprint-run.ts |
| StructuredLogger + LoggerBridge | @cop1/observability | wired-in-run-path | JSONL structured logging; LoggerBridge mirrors EventBus events to log | features/logger/*; StructuredLogger built in orchestrator.ts and SprintRunner; bridge only in SprintRunner |
| EventBus | @cop1/shared-kernel | wired-in-run-path | In-process pub/sub backbone for all orchestrator/session lifecycle events | features/events/domain/EventBus.ts; instantiated in orchestrator.ts and consumed throughout |
| YamlSprintStatusAdapter / sprint-status read | @cop1/app | wired-in-run-path | Reads/writes sprint-status.yaml story statuses; sole intentional BMAD file coupling | features/orchestrator/infrastructure/YamlSprintStatusAdapter.ts; OrchestratorService reads path directly, used by daemon+sprint-status |
| Sprint run command + SprintRunner (legacy run path) | @cop1/app | partial | Older `cop1 sprint run` path: WorkflowEngine over BMADSessionStep pipeline, worktree simulate, checkpoint resume | cli/commands/sprint-run.ts + composition/SprintRunner.ts; separate from orchestrator run, still wired but superseded by EA10 |
| WorkflowEngine + BMADSessionStep | @cop1/sprint-core | partial | Runs ordered WorkflowSteps per story with inter-step quality gate; BMAD steps drive sessions | features/workflow/application/WorkflowEngine.ts; only reachable via sprint-run.ts, not orchestrator run |
| PipelineStepFactory (BMAD branch) | @cop1/app | partial | Builds 3 BMADSessionStep (dev/review/qa) when workflow.useBMAD=true | composition/PipelineStepFactory.ts buildBMADSteps(); used only by sprint-run.ts path |
| Legacy LLM pipeline (DevAgent/ReviewerAgent/QAAgent/PMAgentWorkflowStep) | @cop1/sprint-core | deprecated-legacy | Stub Ollama-backed code-gen/review/QA/PM steps behind deprecated useBMAD=false | PipelineStepFactory.buildLegacySteps(); LEGACY_USE_BMAD_WARNING, ConfigSchema.ts @deprecated; removal scheduled |
| LLM Gateway / Router / Ollama adapter | @cop1/llm-intelligence | deprecated-legacy | Ollama HTTP gateway with model routing for the legacy code-gen/review agents | features/llm-gateway/*; only constructed inside buildLegacySteps() (deprecated path) |
| TokensPerSecMonitor | @cop1/llm-intelligence | deprecated-legacy | Records tokens/sec per agent on llm.call.completed events | features/tokens-monitor; registered only inside buildLegacySteps() in PipelineStepFactory |
| OllamaManagementAdapter | @cop1/llm-intelligence | wired-in-run-path | Checks Ollama availability/models for `cop1 sprint status` output | features/ollama-management; new'd in cli/commands/sprint-status.ts |
| LLM extras (ModelManager, MCPRegistry, AdaptiveLLMService, ProviderRegistry) | @cop1/llm-intelligence | dormant | Model lifecycle, MCP server registry, adaptive escalation, provider registry | exported from barrel only; no non-test, non-barrel consumer found across packages |
| QualityGateService | @cop1/quality-intelligence | partial | Runs an ordered list of quality GatePorts between workflow steps | new QualityGateService() in SprintRunner.ts is constructed with EMPTY gates array — runs nothing |
| Quality gates (CoverageGate, StaticAnalysisGate, SonarQubeAdapter, ArchDriftDetector) | @cop1/quality-intelligence | dormant | Coverage threshold, lint/static analysis, SonarQube, architecture-drift gate implementations | no `new CoverageGate\|StaticAnalysisGate\|SonarQubeAdapter\|ArchDriftDetector` outside tests; never added to QualityGateService |
| Quality config templates | @cop1/quality-intelligence | wired-in-run-path | Provides .cop1 quality config templates copied during project init | @cop1/quality-intelligence/templates consumed by InitService.ts (TEMPLATES import) |
| Quality metrics (review-metrics, retro-metrics, improvement-kpi) | @cop1/quality-intelligence | dormant | Review-quality, retro-quality, and improvement KPI metric services | barrel-only exports; no run-path consumer |
| Ceremony engine (round-table, scrum-master, planning, retro, review, grooming, improvement-review, async-channel) | @cop1/ceremony-engine | dormant | Agile ceremony orchestration (planning/retro/review/grooming/round-table) services | entire package only imported by its own index.ts — zero external consumers |
| BMADReader | @cop1/sprint-core | partial | Lists/loads story files + integrity checks from _bmad-output | features/bmad-reader; used by SprintRunner.run/listEligible (sprint-run path), not orchestrator run |
| CheckpointService | @cop1/sprint-core | partial | Saves/reads/clears per-story checkpoint for crash resume | features/checkpoint; consumed only in SprintRunner.ts (sprint-run path) |
| SprintSessionService | @cop1/sprint-core | wired-in-run-path | Tracks sprint session start/expiry window | features/sprint-session; used by SprintRunner, DaemonService, sprint-status command |
| Session transcript generator + ExchangeHistoryReader | @cop1/sprint-core | wired-in-run-path | Builds human-readable markdown transcript from Track-2 exchange files | SessionTranscriptGenerator + ExchangeHistoryReader; wired in cli/commands/transcript.ts |
| SupervisorContextLoader / SupervisorPromptBuilder | @cop1/sprint-core | dormant | Loads project/arch/iamthelaw context to enrich supervisor prompts | SupervisorContextLoader barrel-only; DefaultBMADCommandRunner passes empty architectureRules/iamtheLawRules |
| iamthelaw (rule loader + sidecar sync) | @cop1/sprint-core | partial | Loads governance RuleSets and syncs sidecar rule files for agents | IamTheLawLoader used by DoDService + bmad-bridge init command, but not loaded into orchestrator session context |
| BMAD bridge (init-bmad-bridge) | @cop1/app | wired-in-run-path | `cop1 init-bmad-bridge` configures BMAD agents to load iamthelaw rules | features/bmad-bridge/application/BmadBridgeService.ts; registered as command in cli/index.ts |
| TokenBudgetService / YamlBudgetStore | @cop1/sprint-core | dormant | Token budget tracking + persistence; budget-kill enforcement | features/budget barrel-only; no run-path consumer — matches known V1.1 budget-kill blocker |
| Validators (DoR, DoD, INVEST) + WSJF + TimeEstimator | @cop1/sprint-core | dormant | Story readiness/definition/INVEST validators, WSJF prioritization, time estimation | all barrel-only exports; no orchestrator/sprint run-path consumer |
| Rule lifecycle (RuleProposal, RuleAutoApply, AutoRuleSuggestion, QualityBinding, PMDecision) | @cop1/sprint-core | dormant | Proposing/auto-applying/suggesting governance rules and PM decisions | barrel-only; not invoked by any CLI command or run path |
| Improvement loop (AgentSelfAssessment, ImprovementPersistence, ImprovementReview) | @cop1/sprint-core | dormant | Agent self-assessment and improvement proposal persistence/review | barrel-only exports; no run-path consumer |
| Sprint reporting (SprintDashboard, SprintEndReport, BacklogMonitor, ConflictPlanner) | @cop1/sprint-core | dormant | Dashboard cards, end-of-sprint report, backlog monitoring, conflict planning | barrel-only; burndown/KPIs/velocity already removed (EA12-S7), these remain unconsumed |
| Story support (StoryStatusTracker, SnapshotService, EnrichmentService, StoryFileLock, MergeService) | @cop1/sprint-core | dormant | Status FSM, story snapshots, prompt enrichment, file locking, merge proposals | barrel-only; orchestrator uses its own inline status rewrite, not StoryStatusTracker |
| Blocage / Escalade services | @cop1/sprint-core | dormant | Blockage tracking and escalation domain services | features/blocage barrel-only; orchestrator handles escalation inline via supervisor result |
| BMADCommandStep / ClaudeCliAdapter (single-shot) | @cop1/sprint-core | dormant | Single-shot CLI command step with retry/budget — superseded by BMADSessionStep | bmad-orchestration barrel-only; run path uses session adapters not ClaudeCliAdapter |
| Session recovery (restoreSession / MetricsWriter / SessionHistoryReader) | @cop1/sprint-core | partial | Crash-recovery resume via captured SDK session_id; metrics + history readers | restoreSession on adapter (EA12-S2) and MetricsWriter exist but no run-path caller invokes recovery |
| Daemon (start/stop/status/health + HttpServer) | @cop1/app | partial | Background daemon exposing /health and /api/sprint/status; PID management | cli start/stop/status/health wired; DaemonService only sets sprint-status provider (no rules/SSE provider) |
| HttpServer rules-proposals API + SSE | @cop1/app | partial | /api/rules/proposals GET/PATCH and /events SSE stream endpoints | HttpServer.ts implements them but DaemonService never calls setRuleProposalProvider()/setEventBus() |
| Web dashboard (React rule-proposals UI) | @cop1/web | dormant | Vite/React app showing sprint status + rule proposals via daemon API | packages/web not in root tsc build; standalone app, backing rules API not wired in daemon |
| Night scheduler | @cop1/app | dormant | Service intended to schedule overnight autonomous runs | features/night-scheduler/application/NightSchedulerService.ts; zero non-self consumers |
| Container runtime (DockerDesktopAdapter) | @cop1/app | dormant | Docker Desktop adapter behind ContainerRuntimePort for isolated execution | features/container-runtime; zero consumers — matches deferred worktree/sandbox blocker |
| App API/service stubs (stories-api, blocage-api, async-notification, co-presence, decision-history, developer-review, ramp-up, resources, rule-application, suspension) | @cop1/app | dormant | Assorted feature services (story/blocage APIs, notifications, co-presence, suspension, ramp-up, etc.) | each features/<x> has zero non-test, non-self consumers; not wired into any CLI command or daemon route |
| Init command + InitService | @cop1/app | wired-in-run-path | `cop1 init <path>` scaffolds .cop1 structure and copies config/quality templates | cli/commands/init.ts -> features/init/application/InitService.ts; registered in cli/index.ts |
| ConfigLoader / Cop1Config schema | @cop1/app | wired-in-run-path | Loads & validates cop1.config.yaml (incl. workflow.useBMAD, sprint duration) | features/config; ConfigLoader used by SprintRunner; Cop1Config type from shared-kernel |
| SessionReportService / JSONLReader | @cop1/observability | dormant | Builds session reports by reading JSONL logs | features/report exported from barrel; no CLI command or run-path consumer |

## Annexe B — État du tiering / routage modèle

## Current state — how model selection works TODAY in the live run path (AgentSdkSessionAdapter / AgentSdkSupervisorAdapter) vs the dormant routing stack

There are effectively **two parallel worlds** in cop1, and only one of them runs in the live overnight path.

**The live path (BMAD-through-SDK).** When `config.workflow.useBMAD = true` (the default, and the only supported route per the deprecation notice in `PipelineStepFactory.ts:34`), the entire epic is driven by the Claude Agent SDK. The orchestrator CLI wires it up in `/Users/elzinko/git/bacasable/cop1/packages/app/src/cli/commands/orchestrator.ts:125-149`:

```ts
const supervisorAdapter = new AgentSdkSupervisorAdapter();          // no model arg
...
sessionPort = new AgentSdkSessionAdapter(eventBus, { questionHandler }); // no maxBudgetUsd, no model
```

Both adapters then call the SDK's `query()`. In `AgentSdkSessionAdapter.executeQuery` (`AgentSdkSessionAdapter.ts:143-158`) the `Options` object passed to `query()` contains:

```ts
const options: Options = {
  systemPrompt: { type: 'preset', preset: 'claude_code' },
  settingSources: ['project'],
  allowedTools: ['Skill', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
  tools: [...],
  maxTurns: this.maxTurns,
  ...(this.maxBudgetUsd !== undefined && { maxBudgetUsd: this.maxBudgetUsd }),
  ...(context?.projectPath && { cwd: context.projectPath }),
  ...(isResume && sdkSessionId ? { resume: sdkSessionId } : {}),
  canUseTool: async (toolName, input) => { ... },
};
```

There is **no `model` field, no `fallbackModel` field, and no `mcpServers` field**. Because `maxBudgetUsd` is also undefined in the live wiring (the orchestrator never passes `options.maxBudgetUsd`), even the per-session cost cap is off. The same is true of the supervisor: `AgentSdkSupervisorAdapter.loadSdkQuery` (`AgentSdkSupervisorAdapter.ts:55-73`) hard-codes the option set to `{ systemPrompt, allowedTools, maxTurns }` — again no `model`.

The consequence: **model choice today is "whatever the Claude Agent SDK / CLI environment defaults to"** — i.e. whatever `ANTHROPIC_MODEL` / the CLI's configured default resolves to (Sonnet or Opus depending on the user's CLI setup). cop1 does not select it, does not vary it per phase, and does not vary it per task. The dev-story session, the code-review session, and the supervisor session all run on the same un-pinned SDK default. There is one big-LLM tier and nothing else in the live path.

**The dormant routing stack.** Everything that *looks* like model tiering — `LLMRouter`, `LLMGateway`, `OllamaAdapter`, `AdaptiveLLMService`, `LLMProviderRegistry`, `ModelManager` — lives in `@cop1/llm-intelligence` and is **only reachable from the legacy stub pipeline**. `LLMRouter.route(commandType)` (`LLMRouter.ts:6-21`) does a config lookup against `config.llm_routing[commandType] ?? config.llm_routing.default` and returns a model string. `LLMGateway.completeForAgent` (`LLMGateway.ts:25-36`) calls `router.route(commandType)` then `provider.complete({ prompt, model, options })`. But the only `provider` ever constructed is `new OllamaAdapter()`, and the only place any of this is instantiated is `PipelineStepFactory.buildLegacySteps()` (`PipelineStepFactory.ts:99-125`), which runs **only when `useBMAD = false`** — the deprecated path slated for removal. So in the real overnight run, `LLMRouter` never executes, `OllamaAdapter` is never hit, and `AdaptiveLLMService` / `LLMProviderRegistry` / `ModelManager` are not even imported by the app (`grep` confirms `PipelineStepFactory.ts` is the sole non-test importer of any of these).

## Machinery present — existing tiering/routing components and where (file paths)

The codebase already contains a fairly complete, well-factored routing toolkit. It is just not wired into the SDK path.

- **Per-command model lookup** — `LLMRouter` at `/Users/elzinko/git/bacasable/cop1/packages/llm-intelligence/src/features/llm-gateway/application/LLMRouter.ts`. Maps a `commandType` string → model string via `config.llm_routing`. This is the literal "which model for which command" decision function, already written.
- **Config schema for routing** — `Cop1Config` at `/Users/elzinko/git/bacasable/cop1/packages/shared-kernel/src/features/config/domain/Cop1Config.ts:24-25` exposes `llm_routing: Record<string, string>` and `llm_fallback: Record<string, string>`. The config surface for big-vs-local routing already exists.
- **Gateway with tracking** — `LLMGateway` at `/Users/elzinko/git/bacasable/cop1/packages/llm-intelligence/src/features/llm-gateway/application/LLMGateway.ts`. `completeForAgent(commandType, …)` resolves the model through the router and emits `llm.call.started` / `llm.call.completed` events (the latter feeds `TokenBudgetService`).
- **Local-LLM adapter** — `OllamaAdapter` at `/Users/elzinko/git/bacasable/cop1/packages/llm-intelligence/src/features/llm-gateway/infrastructure/OllamaAdapter.ts`. Talks to `http://localhost:11434/api/generate` (streaming) and `/api/tags` (health). This is the concrete local executor for the LOCAL tier. It implements `LLMProvider`, takes `request.model`, and streams chunks — fully functional, never invoked in the live path.
- **Failure-based escalation** — `AdaptiveLLMService` at `/Users/elzinko/git/bacasable/cop1/packages/llm-intelligence/src/features/adaptive-escalation/application/AdaptiveLLMService.ts`. Counts consecutive failures per `agentName:storyId`, and after `failureThreshold` (default 2) escalates to a `fallbackConfig[agentName]` model, emitting `llm.escalated`. This is the "start local, escalate to big on repeated failure" mechanism — the dynamic counterpart to the static `llm_routing` table. It is not referenced anywhere in `app` or `sprint-core`.
- **Provider switchboard** — `LLMProviderRegistry` at `/Users/elzinko/git/bacasable/cop1/packages/llm-intelligence/src/features/provider-registry/application/LLMProviderRegistry.ts`. `register(id, provider)` / `setActive(id)` / `getActive()`. A registry that could hold both an Ollama provider and a Claude/SDK provider and flip between them — but nothing registers more than one provider, and the live path never constructs it.
- **Ollama lifecycle** — `ModelManager` at `/Users/elzinko/git/bacasable/cop1/packages/llm-intelligence/src/features/model-manager/application/ModelManager.ts`. `pull` / `activate` / `deactivate` local models and persists `.cop1/models.json`. This is the operational glue for "make sure the local model is pulled and loaded before the run" — needed if Ollama is to be used overnight.
- **Budget accounting** — `TokenBudgetService` at `/Users/elzinko/git/bacasable/cop1/packages/sprint-core/src/features/budget/application/TokenBudgetService.ts`. Subscribes to `llm.call.completed` and accumulates `breakdownByCommand` / `breakdownByAgent`. Notably it keys "command" off the `model` field of the payload (`TokenBudgetService.ts:71`), so a routing decision that varied the model would automatically produce a per-model cost breakdown.
- **SDK-native budget rail** — the `AgentSdkSessionAdapter` already accepts `maxBudgetUsd` and forwards it to the SDK (`AgentSdkSessionAdapter.ts:149`); it is simply never populated by the composition root.

## Disconnects — precisely why the tiering stack is not reachable from the run path

The disconnect is structural, not a missing config value. Five concrete breaks:

1. **Selector at the wrong fork.** `PipelineStepFactory.build()` (`PipelineStepFactory.ts:53-62`) branches on `config.workflow.useBMAD`. The router/gateway/Ollama are constructed *only* inside `buildLegacySteps()` (the `useBMAD = false` arm). The supported arm, `buildBMADSteps()`, constructs `BMADSessionStep`s that talk to `BMADSessionPort` (the SDK) and never touch `@cop1/llm-intelligence`. So tiering lives behind the deprecated flag.

2. **The live executor has no model parameter threaded through.** Even if you wanted to route, `BMADSessionPort` (`/Users/elzinko/git/bacasable/cop1/packages/sprint-core/src/features/bmad-orchestration/domain/ports/BMADSessionPort.ts`) carries no model/tier field. `startSession(command, context)` and `BMADSessionContext` (`projectPath`, `storyId`, `metadata`) have nowhere to express "run this on local vs big". And `AgentSdkSessionAdapter`'s `Options` block omits `model` entirely. There is no parameter to set.

3. **Two different provider abstractions that don't meet.** The dormant stack is built around `LLMProvider` (a streaming `complete(request)` over an HTTP model). The live stack is built around the Agent SDK's `query()` — an *agentic loop* with tools, `canUseTool`, settings sources, and resume. `OllamaAdapter` implements `LLMProvider`; it does **not** implement an agentic loop and cannot run BMAD skills. The registry (`LLMProviderRegistry`) only knows `LLMProvider`, so it cannot register the SDK session adapter at all. The two abstractions are not interchangeable.

4. **Config keys are inert in the live path.** `llm_routing` and `llm_fallback` in `Cop1Config` are only ever read by `LLMRouter` (via the legacy gateway) and by `AdaptiveLLMService.fallbackConfig`. Nothing in the orchestrator/SDK path reads them. A user could fill `llm_routing` with a beautiful big/local map and the overnight run would ignore it.

5. **Docker/Ollama is commented out.** `/Users/elzinko/git/bacasable/cop1/docker-compose.yml` has the entire `ollama` service commented out, and `ModelManager.activate()` is never called in the live path. So even the *runtime* for the local tier isn't started — there is no `localhost:11434` listening unless the user manually runs Ollama. The infra side of the LOCAL tier is also disconnected.

In short: the tiering stack is a complete, tested island reachable only through a deprecated flag, built on a provider abstraction (`LLMProvider`/HTTP) that is incompatible with the live executor abstraction (Agent SDK `query()`), with its config keys unread and its local runtime un-launched.

## Routing seam — the exact place(s) in code where a per-task/per-phase model-or-executor routing decision should plug in (file + function), and what the decision input would be (phase, command, story complexity)

There are three candidate seams, at increasing depth. For the user's goal (big LLM for archi/spec/review, local for trivial code) the decision needs to be made **per BMAD command/phase**, and that maps cleanly to seam B.

**Seam A — coarsest, per-session model param (smallest change).**
File: `/Users/elzinko/git/bacasable/cop1/packages/sprint-core/src/features/bmad-orchestration/infrastructure/AgentSdkSessionAdapter.ts`, function `executeQuery` (lines 143-158). The `Options` object is where a `model` (and optionally `fallbackModel`) belongs. Today it has neither. To route, the adapter needs a model resolved from the command/context and injected:

```ts
const options: Options = {
  systemPrompt: { type: 'preset', preset: 'claude_code' },
  ...(resolvedModel && { model: resolvedModel }),          // <-- routing plugs in here
  ...
};
```

But `executeQuery` only receives `(sessionId, prompt, context, …)` — it does not know the *command* (`/bmad-bmm-dev-story` vs `/bmad-bmm-code-review`). The command is known one layer up in `startSession(command, context)` (line 109). So the model must be resolved in `startSession` and stored alongside the session context, or passed through `BMADSessionContext`/a new param. This requires threading a model field through `BMADSessionPort` (which currently has none). **Caveat:** the SDK `model` option still selects an *Anthropic* model. Setting `model` cannot, by itself, point the agentic loop at Ollama (see the tension section). So Seam A buys you Opus-vs-Sonnet-vs-Haiku tiering, not big-vs-local.

**Seam B — per-phase executor selection (the right seam for big-vs-local).**
File: `/Users/elzinko/git/bacasable/cop1/packages/app/src/features/orchestrator/infrastructure/DefaultBMADCommandRunner.ts`, function `createDefaultBMADCommandRunner` — specifically the returned runner closure `async ({ command, storyKey, epicId, projectRoot }) => { … deps.sessionPort.startSession(command, …) }`. This is the **one place per `(story, command)` tuple** where cop1 decides who executes a phase. The decision input — `command` (the BMAD command, e.g. `/bmad-bmm-dev-story` vs `/bmad-bmm-code-review` vs `/bmad-bmm-create-story`), plus `storyKey`/`epicId` and any story-complexity signal — is all present in this closure's argument. This is where a `routeExecutor(command, story) → 'sdk-big' | 'ollama-local'` policy should select which `BMADSessionPort` implementation to drive. To make it real, `sessionPort` would become a *map/selector* of session ports rather than a single instance, and the runner would pick one based on the command. Mirror seam: `PipelineStepFactory.buildBMADSteps()` (`PipelineStepFactory.ts:64-97`) constructs one `BMADSessionStep` per `DEFAULT_BMAD_PIPELINE_COMMANDS` entry (`dev`, `review`, `qa`) — the same per-command granularity, so the same routing policy could be applied there.

**Decision input, concretely.** The natural routing key is the **BMAD command** (already a typed enum: `DEFAULT_BMAD_PIPELINE_COMMANDS` in `/Users/elzinko/git/bacasable/cop1/packages/sprint-core/src/features/bmad-orchestration/domain/BmadCycle.ts`). A first-cut policy: `/bmad-bmm-create-story`, `/bmad-bmm-code-review`, and any architecture/spec workflow → big SDK; `/bmad-bmm-dev-story` and `/bmad-bmm-qa-automate` → eligible for local, gated by a *story-complexity* signal (story points, file-count estimate, or a label in the story YAML's front-matter). Because phase ≠ task: a single dev-story phase still contains both trivial edits and hard logic, story-level complexity is the only signal available at routing time without sub-task decomposition (this is the crux of the tension below).

**Seam C — provider-level (reuse the dormant stack).**
If a phase is routed to local, the executor for it is `LLMProviderRegistry.getActive()` → `OllamaAdapter`, model resolved by `LLMRouter.route(command)` reading `config.llm_routing`. The dormant components are exactly the right shape for the *local* leg; they just need to be (a) instantiated in the BMAD path and (b) wrapped behind a `BMADSessionPort`-compatible facade. `AdaptiveLLMService.recordFailure(agentName, storyId)` is the natural "local failed twice → escalate this phase to big SDK" hook, plugged into `DefaultBMADCommandRunner`'s error handling.

## ADR-005 mapping — what ADR-005 (LLM Routing + Access Tiers, suspended) specified and how it maps to the user goal (big LLM for archi/spec/review, local LLM for simple code)

**What ADR-005 specified** (architecture.md §57-67 and the ADR block at §228-267):

ADR-005 defined a **three-tier capability model**, not a flat per-command map:

| Tier | LLM | Access | Trigger |
|------|-----|--------|---------|
| Standard | Ollama local (Llama/Mistral/Qwen) | Permanent | Routine tasks |
| Elevated | Claude API / strong cloud LLM | Temporary or permanent per agent | Deep analysis, strategy, **architecture**, complex blockage |
| Super Saiyan | Best available (Claude Opus) | Temporary, agent- or PM-triggered | Critical / irreversible decisions |

And a three-layer mechanism: **Layer 1** static defaults in `cop1.config.yaml` (`agents.dev-agent.llm_default: ollama/llama3.2`, `llm_elevated: anthropic/claude-3-5-sonnet`, `llm_super_saiyan: anthropic/claude-opus-4-5`); **Layer 2** a PM Agent that assigns the tier per task at sprint planning and approves runtime upgrade requests; **Layer 3** a domain interface (`LLMAccessRequest` / `LLMAccessGrant` with `requestedTier`, `requiresManagerApproval`, `expiresAt`). Crucially ADR-005 states the router is a *capabilities-per-agent system with temporary grant/revoke, not a simple config lookup* (§67).

**Its status:** **SUSPENDED on 2026-02-22** (architecture.md §230) by the Phase A BMAD pivot. Rationale: "All agent execution goes through BMADCommandPort → Claude Code CLI… may be reactivated in Phase B when local LLM support is added. See ADR-008." This is the decision that produced today's reality — everything goes through the SDK on one un-tiered Claude model.

**How it maps to the user goal — surprisingly cleanly:**

- **User's "BIG LLM for features/architecture/specs/reviews"** = ADR-005's **Elevated/Super Saiyan** tier (the table literally lists *architecture* and *strategy* as Elevated triggers, and reviews are the deep-analysis category). In today's terms this is the Agent SDK session on Sonnet/Opus — which is what the live path *already* runs for everything.
- **User's "LOCAL LLM for simple coding & trivial tasks"** = ADR-005's **Standard** tier (Ollama local, "tâches courantes"). This is precisely what the dormant `OllamaAdapter` + `LLMRouter` + `config.llm_routing` were built to serve.

So the user's two-tier ask is a **simplification of ADR-005's three tiers**: collapse Standard → "local", and Elevated+Super Saiyan → "big". The mapping requires **none of the heavyweight Layer-2 machinery** ADR-005 envisioned — no PM-Agent approval workflow, no temporary grant/revoke, no `LLMAccessGrant.expiresAt`. For one controlled overnight run, a **static per-command routing table** (`llm_routing`, which already exists in `Cop1Config`) is sufficient: map review/spec/architecture commands → big, dev/trivial commands → local. ADR-005's `AdaptiveLLMService` (failure → escalate Standard to Elevated) is the *only* dynamic piece worth keeping, and it already exists. In other words, the user's goal is best read as **"reactivate the Standard↔Elevated split of ADR-005, statically, for the dev/review phase boundary"** — exactly the Phase B reactivation ADR-005's suspension note anticipated.

## Risks

**1. The hard architectural tension — "simple subtask → local" is not a model param, it's an executor swap.** This is the load-bearing risk. When cop1 drives BMAD *through* the Claude Agent SDK, **the agent loop itself is Claude**. The SDK's `query()` is an agentic runtime: it owns the tool-use loop, reads BMAD skills via `settingSources: ['project']`, intercepts `AskUserQuestion` via `canUseTool`, and resumes sessions. The model running that loop *is* the big LLM. Setting the SDK `model` option to a smaller Anthropic model (Haiku) still keeps you inside Anthropic — it does **not** route to Ollama. To run a phase on a local model you must **replace the executor entirely**: drive that phase through `OllamaAdapter` (raw HTTP completion) instead of the SDK. But `OllamaAdapter`/`LLMProvider` is a *plain completion* abstraction — it has no tool loop, cannot load BMAD skills, cannot intercept questions, cannot resume. So routing a "simple coding subtask" to local is not a 1-line option change; it requires either (a) routing **whole BMAD phases/commands** to a separate non-SDK local executor that re-implements enough of the agent loop (file edits, bash, skill semantics) to run that phase — a substantial build — or (b) keeping the SDK as the loop and only delegating *leaf sub-tasks* to local, which the current architecture has no seam for (the SDK owns sub-task dispatch internally; cop1 cannot intercept "now write this trivial function" and farm it to Ollama). **The routing granularity the architecture can actually support is per-phase/per-command, not per-subtask.** The user's mental model ("local for the trivial coding *within* a story") is finer than the seam (per-command). The honest framing: you can send the *dev-story phase* to local and the *review/spec/architecture phases* to big, but you cannot, without major work, send "the easy 60% of the dev-story phase" to local. Make this explicit before committing the overnight run plan.

**2. Local executor cannot run BMAD natively.** BMAD workflows are Claude Code *skills* loaded via `settingSources: ['project']`. Ollama has no skill system, no `Skill`/`Bash`/`Edit` tool harness. A phase routed to Ollama would need cop1 to supply the file-edit/bash/skill scaffolding around it. Today that scaffolding exists only inside the SDK. This is why ADR-005 was suspended in the first place ("all execution via Claude Code CLI") — the suspension was an admission that local execution of BMAD wasn't viable yet.

**3. Quality cliff on the LOCAL tier.** A local 7-8B model doing real dev-story implementation on a non-trivial story is likely to produce code that fails the very `/bmad-bmm-code-review` and `/bmad-bmm-qa-automate` phases that follow. `AdaptiveLLMService` would then escalate to big after 2 failures — meaning you pay the local cost, then pay the big cost anyway, plus the wasted review cycles. For an *unattended overnight* run this can silently burn the budget while making no progress. Mitigate by routing only genuinely trivial, well-bounded stories to local, and wiring `AdaptiveLLMService` escalation into `DefaultBMADCommandRunner`.

**4. Budget enforcement is currently OFF in the live path.** `maxBudgetUsd` is accepted by `AgentSdkSessionAdapter` but never set by the orchestrator (`orchestrator.ts:138`), and `DefaultBMADCommandRunner`'s own doc-comment says "no budget gate." `TokenBudgetService` exists but is fed only by `llm.call.completed`, which is emitted by `LLMGateway` (legacy path) — the SDK adapters emit `session.*` events, not `llm.call.completed`, so **TokenBudgetService sees nothing in the live path**. For a controlled overnight run, the budget kill-switch the user wants is not currently armed regardless of tiering. This must be fixed alongside routing.

**5. Ollama runtime not provisioned.** `docker-compose.yml` has the `ollama` service commented out and `ModelManager.activate()` is never called. If a phase is routed to `localhost:11434` and nothing is listening, `OllamaAdapter` throws `LLMUnavailableError`. Before any overnight run with a LOCAL tier, the Ollama container must be up and the target model pulled/loaded (the `ModelManager.pull`/`activate` path), or every local phase fails instantly.

**6. Config keys give false confidence.** `llm_routing` and `llm_fallback` are live fields in `Cop1Config` but inert in the BMAD path. A user filling them in and launching an overnight run would reasonably expect routing to happen, and get none — a silent no-op. Any reactivation should either wire these keys into the BMAD path or fail loudly if they're set while `useBMAD = true`.

**7. The supervisor is a third, separate model decision.** `AgentSdkSupervisorAdapter` spawns its *own* SDK session per call with no model set (`AgentSdkSupervisorAdapter.ts:66-73`). ADR-012 §8.2 explicitly flagged "use Haiku for simple supervisor questions, Sonnet/Opus for complex" and ADR-012 §3 lists `OllamaSupervisorAdapter` as a future V2 item — none of which is implemented. So even within "big", the supervisor's model is un-tuned and uncapped. If the goal is cost control overnight, the supervisor's per-question model is a second routing decision that the current code doesn't expose.

Relevant files for any implementation: routing seam at `/Users/elzinko/git/bacasable/cop1/packages/app/src/features/orchestrator/infrastructure/DefaultBMADCommandRunner.ts` (per-command executor selection) and `/Users/elzinko/git/bacasable/cop1/packages/sprint-core/src/features/bmad-orchestration/infrastructure/AgentSdkSessionAdapter.ts:143-158` (per-session SDK `model`); the local leg is `/Users/elzinko/git/bacasable/cop1/packages/llm-intelligence/src/features/llm-gateway/{application/LLMRouter.ts,application/LLMGateway.ts,infrastructure/OllamaAdapter.ts}` plus `adaptive-escalation/application/AdaptiveLLMService.ts`; config surface is `/Users/elzinko/git/bacasable/cop1/packages/shared-kernel/src/features/config/domain/Cop1Config.ts` (`llm_routing`, `llm_fallback`); budget at `/Users/elzinko/git/bacasable/cop1/packages/sprint-core/src/features/budget/application/TokenBudgetService.ts`; and the ADR-005 tier spec at `/Users/elzinko/git/bacasable/cop1/_bmad-output/planning-artifacts/architecture.md:57-67,228-267` (suspended note at line 230).

## Annexe C — État du runner de nuit

**Building blocks présents :**

- Night scheduler: packages/app/src/features/night-scheduler/application/NightSchedulerService.ts — pure shouldStart/getNextScheduled logic; DORMANT (zero callers in src, no loop drives it).
- Token budget tracker: packages/sprint-core/src/features/budget/application/TokenBudgetService.ts + YamlBudgetStore.ts — tracks consumption per day/agent/model with persistence; DORMANT on live path (never constructed in src; subscribes to llm.call.completed which only the legacy ClaudeCliAdapter/LLMGateway emit, NOT AgentSdkSessionAdapter).
- Worktree isolation: packages/sprint-core/src/features/dev-agent/{application/WorktreeService.ts,infrastructure/WorktreeManager.ts} — create/cleanup/list via git worktree; WIRED only to legacy DevAgent.ts (and tool catalog), NOT to the live orchestrator runner.
- SDK-native per-session budget cap: packages/sprint-core/src/features/bmad-orchestration/infrastructure/AgentSdkSessionAdapter.ts line 149 supports Options.maxBudgetUsd + maxTurns(default 30); DORMANT (orchestrator.ts line 138 constructs adapter with only {questionHandler}).
- Step-by-step gate: packages/sprint-core/src/features/workflow/application/StepByStepController.ts + packages/app/src/features/orchestrator/infrastructure/InterCommandApprovalResolver.ts — inter-command pause via TTY or COP1_APPROVAL_FILE (y/n/abort); WIRED into OrchestratorService gate (only active in step-by-step mode).
- Escalation/abort modes: packages/app/src/features/orchestrator/application/OrchestratorService.ts — mode 'abort-on-escalation' marks story blocked and breaks loop; WIRED. AdaptiveLLMService (packages/llm-intelligence/.../AdaptiveLLMService.ts) NOT wired into app.
- 3-track history/observability: sprint-status.yaml ledger (OrchestratorService.persistStatus) + JSONL auto-decision log (orchestrator.ts autoDecisionLogger → .cop1/sprint-log-DATE.jsonl) + Track-2 exchange markdown (ExchangeHistoryWriter via DefaultBMADCommandRunner); WIRED. EventBus emits orchestrator.* events; WIRED.
- Fresh-context-per-iteration: DefaultBMADCommandRunner starts one BMADSessionPort session per (story,command) and drains interactionCollector between commands; WIRED.
- Checkpoint/suspend primitives: packages/sprint-core/src/features/checkpoint/application/CheckpointService.ts (atomic .cop1/checkpoint.yaml) + SuspensionService; exist and used by SprintRunner/WorkflowEngine but NOT wired into OrchestratorService.
- Iteration limiter: packages/sprint-core/src/features/iteration-limiter/application/IterationLimiter.ts — throws MaxIterationsError after N; exists, NOT wired into orchestrator loop (loop uses MAX_FOLLOWUP_TURNS=3 in DefaultBMADCommandRunner instead).
- Daemon: packages/app/src/features/daemon/application/DaemonService.ts + cli/daemon-entry.ts — HTTP status server exposing stories/session only; has SIGTERM/SIGINT handlers for itself but does NOT spawn or control the orchestrator/scheduler.

**Manquant pour un run de nuit contrôlé :**

| Item | Pourquoi | Sévérité |
|---|---|---|
| Budget/token-or-USD cap ENFORCEMENT on the live path | TokenBudgetService only tracks and is never constructed; SDK maxBudgetUsd exists but orchestrator never passes it, so an overnight run has no spend ceiling. | blocker |
| Real verification gate (tests/lint/build) before marking a story done | inferNextStatus() in DefaultBMADCommandRunner maps command name → status with zero checks; no test/lint/build/git anywhere in the runner path. | blocker |
| Non-interactive kill-switch / external abort | Abort is only cooperative (step-by-step token / escalation mode) and the orchestrator is a foreground process the daemon SIGTERM cannot reach. | blocker |
| Per-story git-worktree isolation wired into the live loop | AgentSdkSessionAdapter runs with cwd=shared projectRoot; WorktreeManager exists but is wired only to legacy DevAgent, so parallel/sequential stories collide on one tree. | high |
| Crash resumability for the orchestrator loop | CheckpointService is not wired into OrchestratorService; recovery relies on re-running and skipping stories already marked done/cancelled in sprint-status.yaml. | high |
| A driver that actually launches the run unattended at night | NightSchedulerService has zero callers and the daemon never invokes the orchestrator, so nothing starts the run on schedule. | high |
| Auto-commit of verified per-story work | The live runner writes files via the SDK session but never git-adds/commits, so overnight output is uncommitted and can be lost or entangled. | high |
| Model tiering on the live path (Opus/Sonnet by command) | AgentSdkSessionAdapter sets no Options.model; every command runs the default model, inflating cost and risk over a long night. | medium |
| Per-story retry/iteration ceiling in the loop | On failure the loop marks blocked and moves on (no retry); IterationLimiter exists but is unwired, so transient failures aren't retried and loops aren't bounded by it. | medium |
| Live-path token accounting feeding the budget | AgentSdkSessionAdapter does not emit llm.call.completed, so even if the budget service were constructed it would see zero consumption. | medium |
| Health/heartbeat + alerting for a stuck run | No watchdog detects a session hung under maxTurns=30 or an SDK stall; an overnight run could silently idle until morning. | low |

**Comparaison boucle Ralph :** A Ralph-style loop is: fresh context each iteration, pick exactly one task, implement → verify (tests/lint) → commit, optionally fan out across isolated worktrees, and repeat until done or budget-exhausted. cop1's OrchestratorService loop matches the structural skeleton: it iterates stories × playbook phases, runs one (story, command) per iteration, and each command gets a genuinely fresh Agent SDK session with interactions drained between commands — so fresh-context-per-iteration and pick-one-task are real and wired. It also persists a sprint-status.yaml ledger and emits structured events, giving deterministic, replayable progress. Where it diverges sharply is the 'verify → commit' half of the cycle: there is no verification gate (inferNextStatus string-maps the command name to a status), and the live runner never git-commits, so 'done' is asserted, not proven — the single most un-Ralph-like gap. It also lacks the safety rails a Ralph loop needs to run unattended: no enforced token/USD budget with a hard stop, no external kill-switch, and no crash-resume (CheckpointService is unwired). Worktree isolation, the enabler of Ralph-style parallelism, exists (WorktreeManager) but is wired only to the legacy DevAgent, so the live loop runs every story in one shared tree and cannot parallelize safely. Net: cop1 has Ralph's iteration engine and fresh-context discipline but is missing Ralph's trust mechanisms — verify-before-done, commit-per-task, budget kill, resume, and per-task isolation — which are exactly the four documented blockers, none yet built.

## Annexe D — Normes du Claude Agent SDK

## Model per query — exact current way to set the model on an Agent SDK query() / ClaudeAgentOptions (param name, accepted values incl. opus/sonnet/haiku aliases). Cite docs.

In the Claude Agent SDK (Managed Agents), the model is defined at **agent creation time** via the `model` parameter, not per query. When you create an agent using `client.beta.agents.create()`, you pass:

```typescript
const agent = await client.beta.agents.create({
  name: "My Agent",
  model: "claude-opus-4-8",  // Model specified here at agent creation
  system: "...",
  tools: [...]
});
```

The `model` parameter accepts full model IDs or aliases. Current accepted values (as of June 2026) include:

**Current models (as of documentation):**
- `claude-opus-4-8` — Claude Opus 4.8 (most capable Opus tier)
- `claude-sonnet-4-6` — Claude Sonnet 4.6 (speed + intelligence balance)
- `claude-haiku-4-5` or `claude-haiku-4-5-20251001` — Claude Haiku 4.5 (fastest)
- `claude-opus-4-7` — Claude Opus 4.7 (legacy, still available)
- `claude-opus-4-6` — Claude Opus 4.6 (legacy)

The model can be passed as a string (uses latest version) or as an object for more control:

```typescript
const agent = await client.beta.agents.create({
  model: {
    id: "claude-opus-4-8",
    speed: "standard"  // or "fast" for fast mode if supported
  }
});
```

**Important:** You cannot change the model per individual query/message within a session. The model is locked to what the agent was created with. To use a different model for a different phase/story, you must create a separate agent with that model, then create sessions that reference the appropriate agent.

Reference: [Define your agent](https://platform.claude.com/docs/en/managed-agents/agent-setup.md)

---

## Per-subagent model — can subagents / agent definitions use a different model than the main loop? How (AgentDefinition.model, settingSources, .claude/agents). Cite docs.

In the Managed Agents framework (cloud API), each **agent is independent and versioned**. You cannot have "subagents" inherit or override the model—each agent has its own model baked in at creation time.

For multi-agent setups, the architecture is:
1. **Coordinator agent** — the main agent that orchestrates work and delegates to specialist agents
2. **Specialist agents** — separate agents, each with their own model choice

When the coordinator creates a session and delegates to a specialist, it references the specialist agent by ID (or ID + version). The specialist agent runs in its own session with its configured model.

```typescript
// Create a low-cost specialist agent for mechanical tasks
const mechanicalAgent = await client.beta.agents.create({
  name: "Mechanical Specialist",
  model: "claude-haiku-4-5",  // Cheap, fast
  system: "You handle repetitive formatting tasks.",
  tools: [...]
});

// Create a high-capability agent for complex decisions
const architectAgent = await client.beta.agents.create({
  name: "Architecture Specialist",
  model: "claude-opus-4-8",  // Expensive, powerful
  system: "You make architectural decisions.",
  tools: [...]
});
```

The coordinator agent then delegates by specifying which agent to use (via the `multiagent` field when setting up the coordinator, or via A2A API calls within a session).

**Note on Claude Code `.claude/agents`:** This is a local development feature unrelated to Managed Agents. Claude Code skills like `/sprint-builder` can create and manage subagents locally via hooks, but the Managed Agents cloud API does not use `.claude/agents` files. The `.claude/agents` structure is internal to Claude Code's local agent orchestration.

Reference: [Define your agent](https://platform.claude.com/docs/en/managed-agents/agent-setup.md) — Managed Agents docs do not yet detail multi-agent delegation (marked for future ADR-014 work).

---

## mcpServers wiring — correct current way to pass in-process MCP tools (createSdkMcpServer + mcpServers option) into a query so the agent can call them (e.g. commit_anchor), and how allowedTools must include the mcp tool name. Cite docs.

There are **two separate mechanisms** for MCP in the Managed Agents SDK (2026):

### 1. **Remote MCP Servers (via URL)** — Supported in Managed Agents API

Define MCP servers at **agent creation time**:

```typescript
const agent = await client.beta.agents.create({
  name: "Dev Assistant",
  model: "claude-opus-4-8",
  mcp_servers: [
    {
      type: "url",
      name: "commit_anchor",  // User-defined name for this server
      url: "http://localhost:8765/mcp",  // Remote MCP endpoint
    },
  ],
  tools: [
    { type: "agent_toolset_20260401" },
    {
      type: "mcp_toolset",
      mcp_server_name: "commit_anchor",  // Must match mcp_servers.name
      // Optional: disable specific tools
      default_config: { enabled: true },
      configs: [
        { name: "record_commit", enabled: true },
      ],
    },
  ],
});
```

Then pass authentication at **session creation** time via `vault_ids`:

```typescript
const session = await client.beta.sessions.create({
  agent: agent.id,
  environment_id: environment.id,
  vault_ids: [vault.id],  // Vault contains OAuth/bearer token for commit_anchor server
});
```

**Key constraint:** The Managed Agents API (as of 2026) **only supports remote MCP servers via URL**. There is no `createSdkMcpServer` equivalent in the cloud API.

### 2. **In-Process MCP (Local, not yet in Managed Agents GA)**

The SDK (TypeScript `@anthropic-ai/sdk`) has experimental support for in-process MCP via `createSdkMcpServer` (per the MCP connector docs), but this is **not exposed in the Managed Agents cloud API**. In-process MCP would be available if building a custom agent using the low-level Messages API with tool definitions, not through Managed Agents.

**For cop1 (your use case):** Since you're calling `sdk.query()` with the Managed Agents API, you **cannot use in-process MCP directly**. Options:

1. **Host commit_anchor as a remote MCP server** (e.g., via Node.js MCP SDK) and declare it with `mcp_servers: [{type: "url", ...}]`
2. **Implement commit_anchor as a custom tool** in the agent definition and handle execution via `user.custom_tool_result` events in your session loop

Reference: [MCP connector](https://platform.claude.com/docs/en/managed-agents/mcp-connector.md)

---

## Local or custom model endpoint — supported ways to point the SDK/Claude Code at a non-default / non-Anthropic / local model endpoint: ANTHROPIC_BASE_URL / gateway, Bedrock/Vertex, LiteLLM-as-Anthropic-proxy. What is officially supported vs a hack. Cite docs.

The Claude Agent SDK (Managed Agents) **does not support custom model endpoints** in the cloud API. The agent model must be one of the official Claude models (`claude-opus-4-8`, `claude-sonnet-4-6`, etc.) running on Anthropic's infrastructure.

### Officially Supported Alternatives

**1. Amazon Bedrock** — Run Claude models through AWS Bedrock

Use Bedrock model IDs in agent creation:

```typescript
// Via AWS Bedrock adapter (if available in SDK)
const agent = await client.beta.agents.create({
  model: "anthropic.claude-opus-4-8",  // Bedrock-style ID
  // ...
});
```

See [Claude in Amazon Bedrock](https://platform.claude.com/docs/en/build-with-claude/claude-in-amazon-bedrock).

**2. Vertex AI** — Run Claude models through Google Vertex AI

```typescript
const agent = await client.beta.agents.create({
  model: "claude-opus-4-8",  // Vertex AI ID
  // ...
});
```

See [Claude on Vertex AI](https://platform.claude.com/docs/en/build-with-claude/claude-on-vertex-ai).

**3. Claude Platform on AWS** — AWS-hosted Anthropic console

Model IDs are the same as Claude API (`claude-opus-4-8`), but routed through AWS infrastructure.

### Not Officially Supported

- **ANTHROPIC_BASE_URL** — The Managed Agents API does not support custom base URLs. The SDK always routes to Anthropic's production API.
- **LiteLLM proxy** — No official support. If you run a LiteLLM proxy mimicking the Anthropic API, the SDK would theoretically work, but this is unsupported and untested.
- **Local Ollama/LM Studio** — No integration; would require a custom wrapper outside the SDK.
- **Model gateway routing** — Not available in Managed Agents. (This is available in some cloud providers' agent frameworks but not Anthropic's.)

### For Claude Code (Local)

If you're using Claude Code locally and want to route through a custom endpoint for the Messages API (not Managed Agents), set:

```bash
export ANTHROPIC_BASE_URL="http://localhost:8000/v1"
```

But this applies to Messages API only, not the Managed Agents SDK.

Reference: [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview.md)

---

## Permissions & hooks — permissionMode / canUseTool / hooks needed for unattended (non-interactive, auto-approve in a sandbox) runs. Cite docs.

### Permission Policies in Managed Agents

To run agents unattended (auto-approve all tool calls), set permission policies at **agent creation**:

```typescript
const agent = await client.beta.agents.create({
  name: "Unattended Dev Agent",
  model: "claude-opus-4-8",
  tools: [
    {
      type: "agent_toolset_20260401",
      default_config: {
        permission_policy: {
          type: "always_allow"  // Auto-approve all built-in tools
        }
      }
    },
    {
      type: "mcp_toolset",
      mcp_server_name: "commit_anchor",
      default_config: {
        permission_policy: {
          type: "always_allow"  // Auto-approve all MCP tools
        }
      }
    },
  ],
});
```

**Permission policy types:**
- `{ type: "always_allow" }` — Tool executes without confirmation (unattended)
- `{ type: "always_ask" }` — Session pauses; requires you to send a `user.tool_confirmation` event to approve/deny

To auto-approve most tools but require approval for sensitive ones:

```typescript
{
  type: "agent_toolset_20260401",
  default_config: {
    permission_policy: { type: "always_allow" }
  },
  configs: [
    {
      name: "bash",
      permission_policy: { type: "always_ask" }  // Require approval for bash only
    }
  ]
}
```

### For Custom Tools

Custom tools (defined in the `tools` array with `type: "custom"`) are **not governed by permission policies**. Your application receives an `agent.custom_tool_use` event, and you decide whether to execute it. This gives you full control over custom tool execution without needing the permission policy system.

### Hooks (Local Claude Code, not Managed Agents)

If you're using Claude Code locally (not the cloud Managed Agents API), hooks are configured in `.claude/hooks.yaml` or `.claude/settings.json`:

```json
{
  "hooks": {
    "preCommand": {
      "always": ["bash: ..."]
    },
    "postCommand": {
      "autoApprove": ["bash: ..."]
    }
  }
}
```

But this is local-only and does not apply to Managed Agents sessions.

Reference: [Permission policies](https://platform.claude.com/docs/en/managed-agents/permission-policies.md)

---

## Sessions & resume — multi-turn session + resume/fork APIs relevant to a per-story session and crash recovery. Cite docs.

### Multi-Turn Sessions

A session maintains conversation state and persists across multiple user events (message sends). When you create a session, it stays alive until you close it or it times out:

```typescript
// Create session once
const session = await client.beta.sessions.create({
  agent: agent.id,
  environment_id: environment.id,
});

// Send first message
await client.beta.sessions.events.send(session.id, {
  events: [{
    type: "user.message",
    content: [{ type: "text", text: "Implement feature X" }]
  }]
});

// Agent responds, tool calls happen, session.status_idle emitted

// Send follow-up message in same session
await client.beta.sessions.events.send(session.id, {
  events: [{
    type: "user.message",
    content: [{ type: "text", text: "Now add tests" }]
  }]
});

// And so on...
```

### Session Lifecycle & Pause Points

Sessions emit status events:
- `session.status_running` — agent actively working
- `session.status_idle` — agent finished or waiting for input
- `session.status_error` — session encountered a fatal error

The session acts as a state machine. You can pause indefinitely between events (no timeout requirement between sends).

### Session Persistence & Recovery

**Session recovery/resume:**
- Sessions are persisted by Anthropic. If your client crashes, you can reconnect to the same session by ID.
- To retrieve a session: `client.beta.sessions.retrieve(session.id)`
- To list all sessions: `client.beta.sessions.list()`

```typescript
// Crash recovery: retrieve previous session by ID
const previousSession = await client.beta.sessions.retrieve("session_abc123");

// Resume in the same session
await client.beta.sessions.events.stream(previousSession.id); // Reconnect and stream events
```

**Session archival:**
- Sessions are automatically archived after they finish (no explicit "close" needed).
- You can manually archive: `client.beta.sessions.archive(session.id)`

### Fork/Branch (Not Available in GA)

The Managed Agents API (2026) **does not provide fork/branch APIs**. Each session is independent. There is no built-in way to fork a session to explore an alternate branch and then merge back.

**Workaround for story recovery:**
1. Log session events/checkpoints to your application database
2. If a story fails, create a new session with the agent and replay events up to the checkpoint
3. Send a corrected user message to continue from the recovery point

### For cop1 (Story-per-Session Pattern)

**Recommended architecture:**
- 1 session per story (per epic in a sprint)
- At story start: create session
- Periodically: checkpoint session ID + latest event ID to persistent storage
- On crash: retrieve session by ID, stream from last known event, optionally send a recovery message

```typescript
// Pseudocode for cp1 workflow
const storySession = await createSessionForStory(story);
let lastCheckpointEventId = null;

// Stream events and checkpoint periodically
for await (const event of streamSessionEvents(storySession.id)) {
  processEvent(event);
  if (event.type === "session.status_idle") {
    lastCheckpointEventId = event.id;
    await saveCheckpoint(story.id, storySession.id, lastCheckpointEventId);
  }
  if (shouldCrash()) break;  // Simulate crash
}

// On recovery:
const recoverySession = await client.beta.sessions.retrieve(storySession.id);
// Continue using recoverySession as normal; SDK handles replay
```

Reference: [Sessions](https://platform.claude.com/docs/en/managed-agents/sessions.md)

---

## Billing note — any current cost/billing nuance for headless SDK runs (metered credits / API rate).

Managed Agents sessions are billed via **metered API usage**, same as the Messages API:

- **Input tokens:** Charged per million tokens at the model rate (e.g., Claude Opus 4.8 = $5 / MTok input)
- **Output tokens:** Charged at the model output rate (e.g., Claude Opus 4.8 = $25 / MTok output)
- **Tool use overhead:** Each tool call (including MCP tools) adds tokens; see [Pricing—Tool use system prompt token count](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-use.md#pricing) for the overhead per model

**No special pricing for headless/unattended runs.** You pay the same per-token rate whether running interactively or in a headless loop.

**Batch API discounts apply:** If you queue sessions into the Batch API (instead of real-time), you get a ~50% discount on token costs. The Managed Agents API supports batch submission, though not yet fully documented in the quickstart.

**Session persistence is free:** Storing a session between events does not incur charges.

**MCP/custom tools:** External API calls made by MCP tools (e.g., GitHub API via MCP) are charged by the MCP server provider, not Anthropic, and billed separately.

Reference: [Models overview—Pricing](https://platform.claude.com/docs/en/about-claude/models/overview.md)

---

## Recommended wiring for cop1 — concrete: how to (a) pass model per phase, (b) attach commit_anchor MCP, (c) run unattended.

### Architecture for cop1

Since you need different models per phase (Opus for architecture, Sonnet for implementation), create **separate agents** for each phase:

```typescript
// 1. Create phase-specific agents (at startup, once)
const architectAgent = await client.beta.agents.create({
  name: "Architecture Phase Agent",
  model: "claude-opus-4-8",  // Expensive, powerful
  system: "You are an architect. Make decisions about module structure and dependencies.",
  mcp_servers: [
    {
      type: "url",
      name: "commit_anchor",
      url: "http://localhost:8765/mcp",  // Your in-process MCP server endpoint
    },
  ],
  tools: [
    { type: "agent_toolset_20260401" },
    {
      type: "mcp_toolset",
      mcp_server_name: "commit_anchor",
      default_config: {
        permission_policy: { type: "always_allow" }  // Unattended: auto-approve
      }
    },
  ],
});

const devAgent = await client.beta.agents.create({
  name: "Dev Phase Agent",
  model: "claude-sonnet-4-6",  // Faster, cheaper
  system: "You are a developer. Implement features in clean code.",
  mcp_servers: [
    {
      type: "url",
      name: "commit_anchor",
      url: "http://localhost:8765/mcp",
    },
  ],
  tools: [
    { type: "agent_toolset_20260401" },
    {
      type: "mcp_toolset",
      mcp_server_name: "commit_anchor",
      default_config: {
        permission_policy: { type: "always_allow" }
      }
    },
  ],
});

const reviewAgent = await client.beta.agents.create({
  name: "Review Phase Agent",
  model: "claude-opus-4-8",  // Back to powerful for review decisions
  system: "You are a senior reviewer. Assess code quality.",
  tools: [
    { type: "agent_toolset_20260401" },
  ],
});
```

### 2. Per-Story Session Loop

```typescript
async function runStory(story: Story, vault: Vault) {
  // Architecture phase
  const archSession = await client.beta.sessions.create({
    agent: architectAgent.id,
    environment_id: environment.id,
    vault_ids: [vault.id],  // Vault has commit_anchor OAuth token
  });

  await client.beta.sessions.events.send(archSession.id, {
    events: [{
      type: "user.message",
      content: [{ type: "text", text: `Work on: ${story.title}\n\n${story.description}` }]
    }]
  });

  // Stream until idle
  for await (const event of streamEvents(archSession.id)) {
    if (event.type === "session.status_idle") {
      saveCheckpoint(story, archSession.id, "architecture_complete");
      break;
    }
  }

  // Dev phase (new session, different agent)
  const devSession = await client.beta.sessions.create({
    agent: devAgent.id,
    environment_id: environment.id,
    vault_ids: [vault.id],
  });

  await client.beta.sessions.events.send(devSession.id, {
    events: [{
      type: "user.message",
      content: [{ type: "text", text: `Implement: ${story.title}` }]
    }]
  });

  for await (const event of streamEvents(devSession.id)) {
    if (event.type === "session.status_idle") {
      saveCheckpoint(story, devSession.id, "dev_complete");
      break;
    }
  }

  // Review phase
  const reviewSession = await client.beta.sessions.create({
    agent: reviewAgent.id,
    environment_id: environment.id,
  });

  // Send review request
  await client.beta.sessions.events.send(reviewSession.id, {
    events: [{
      type: "user.message",
      content: [{ type: "text", text: `Review the implementation of: ${story.title}` }]
    }]
  });

  for await (const event of streamEvents(reviewSession.id)) {
    if (event.type === "session.status_idle") {
      saveCheckpoint(story, reviewSession.id, "review_complete");
      break;
    }
  }
}
```

### 3. MCP Server Hosting

Your `commit_anchor` MCP tool must run as a separate process listening on `http://localhost:8765/mcp`:

```typescript
// MCP server (e.g., Node.js with @modelcontextprotocol/sdk)
const { Server } = require("@modelcontextprotocol/sdk/server/stdio");
const server = new Server({
  name: "commit_anchor",
  version: "1.0.0",
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: "commit-anchor://write",
      name: "record_commit",
      description: "Record a commit anchor in the codebase"
    }
  ]
}));

// Expose via HTTP transport (not stdio)
// Use @modelcontextprotocol/sdk with http-transport or fastify adapter
```

Reference: [MCP connector](https://platform.claude.com/docs/en/managed-agents/mcp-connector.md)

### 4. Unattended Overnight Run

For the overnight autonomous mode (no user approvals):

- All agents already have `permission_policy: { type: "always_allow" }` in the example above
- Sessions run end-to-end without pausing for confirmations
- Session crashes are handled by the checkpoint/recovery loop in your orchestrator

---

## Citations

All information sourced from official Anthropic Claude Agent SDK and Claude API documentation (June 2026):

- [Define your agent](https://platform.claude.com/docs/en/managed-agents/agent-setup.md)
- [Start a session](https://platform.claude.com/docs/en/managed-agents/sessions.md)
- [MCP connector](https://platform.claude.com/docs/en/managed-agents/mcp-connector.md)
- [Permission policies](https://platform.claude.com/docs/en/managed-agents/permission-policies.md)
- [Tools](https://platform.claude.com/docs/en/managed-agents/tools.md)
- [Tool use overview](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-use.md)
- [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview.md)
- [Get started with Claude Managed Agents](https://platform.claude.com/docs/en/managed-agents/quickstart.md)

## Annexe E — Routage LLM local (LiteLLM + Ollama)

## Recommended topology — the clean way to give cop1 a local tier

The in-the-norms topology is a single **LiteLLM Proxy Server** sitting in front of **Ollama**, exposing LiteLLM's **unified Anthropic-format endpoint** (`/v1/messages`) on `http://localhost:4000`. The cop1 orchestrator already drives work through the Claude Agent SDK, and the SDK (like Claude Code) honors `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN`. So the local tier is wired in by pointing the SDK at LiteLLM and naming a model that LiteLLM has mapped to Ollama.

The key architectural fact that makes this clean: LiteLLM's unified `/v1/messages` endpoint accepts Anthropic Messages-format requests and **translates them to any supported provider**, including Ollama — "All LiteLLM supported providers: `openai`, `anthropic`, `bedrock`, `vertex_ai`, `gemini`, `azure`, …" can be called through that one Anthropic-shaped endpoint. That means the *same* gateway that serves big Claude (via Bedrock/Vertex/Anthropic passthrough) also serves a local Ollama model, and the orchestrator selects between them purely by the `model` string.

Concretely, cop1 routes the SIMPLE tier by choosing which model name to pass to the SDK per subtask. There are two viable wiring patterns:

- **One gateway, two model names (recommended).** LiteLLM exposes both `big-claude` (→ Bedrock/Vertex/Anthropic) and `local-qwen` (→ `ollama_chat/...`). The orchestrator decides the tier for each story/subtask and constructs `ClaudeAgentOptions(model="local-qwen")` or `model="big-claude"`. One base URL, one proxy, per-call model selection.
- **Two SDK sessions / two base URLs.** A big-tier SDK session pointed at Anthropic/Bedrock and a separate simple-tier SDK session pointed at the LiteLLM→Ollama endpoint. Useful if you want hard isolation (different budgets, different system prompts, different tool allowlists).

Config sketch (`config.yaml` for the LiteLLM proxy):

```yaml
model_list:
  # --- BIG tier: hard reasoning / spec / review ---
  - model_name: big-claude            # what cop1 asks for
    litellm_params:
      model: bedrock/anthropic.claude-opus-4-5-20251101-v1:0
      aws_region_name: us-east-1
  - model_name: review-claude
    litellm_params:
      model: anthropic/claude-sonnet-4-5
      api_key: os.environ/ANTHROPIC_API_KEY

  # --- SIMPLE tier: local Ollama ---
  - model_name: local-coder           # cop1 asks for this on simple subtasks
    litellm_params:
      model: ollama_chat/qwen2.5-coder:7b   # ollama_chat/ → /api/chat (recommended)
      api_base: http://localhost:11434
      keep_alive: "8m"
    model_info:
      supports_function_calling: true        # declare tool-calling capability

litellm_settings:
  # big tier falls back to a cloud model if local is overloaded; simple
  # tier can fall back to a cheap cloud model on local failure
  fallbacks: [{"local-coder": ["review-claude"]}]
```

Orchestrator side (Python, Claude Agent SDK):

```python
import os
from claude_agent_sdk import query, ClaudeAgentOptions

os.environ["ANTHROPIC_BASE_URL"] = "http://localhost:4000"   # the LiteLLM proxy
os.environ["ANTHROPIC_AUTH_TOKEN"] = os.environ["LITELLM_MASTER_KEY"]

def model_for(task) -> str:
    # cop1's tiering policy: trivial/mechanical → local, else big
    return "local-coder" if task.tier == "SIMPLE" else "big-claude"

async def run(task):
    async for msg in query(
        prompt=task.prompt,
        options=ClaudeAgentOptions(
            model=model_for(task),
            allowed_tools=["Read", "Edit", "Bash", "Glob", "Grep"],
        ),
    ):
        ...
```

This is exactly the pattern the LiteLLM "Claude Agent SDK with LiteLLM" tutorial documents: set `ANTHROPIC_BASE_URL="http://localhost:4000"`, set `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN` to the LiteLLM key, and pass `ClaudeAgentOptions(model="<a model_name from config.yaml>")` — "the agent loop itself executes on whichever model you designate."

The `keep_alive` and `ollama_chat/` choices matter for an overnight run: `ollama_chat/` hits Ollama's `/api/chat` (better tool/chat behavior than the legacy `/api/generate` that bare `ollama/` uses), and `keep_alive` keeps the model resident in VRAM between the many small simple-tier calls so you don't pay model-load latency on every subtask.

---

## Can the Claude Agent SDK use a local model — honest verdict

**Verdict: Yes — the SDK's own agent loop can run on a local Ollama model, via LiteLLM's unified Anthropic `/v1/messages` endpoint set as `ANTHROPIC_BASE_URL`. A separate local executor is NOT architecturally required.** But there is an important reliability caveat that means in practice you should treat the local tier as "trust-but-verify," and a separate executor remains a legitimate fallback.

The evidence chain:

1. **The SDK is the Claude Code agent loop as a library, and it honors gateway env vars.** The official Agent SDK overview states the SDK "gives you the same tools, agent loop, and context management that power Claude Code." The official LLM-gateway doc says any gateway exposing the **Anthropic Messages** format (`/v1/messages`, `/v1/messages/count_tokens`) works, and you point the client at it with `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN`. The SDK and CLI share this configuration surface.

2. **LiteLLM's unified `/v1/messages` endpoint can target non-Anthropic models.** LiteLLM's `anthropic_unified` docs explicitly list non-Anthropic providers callable through `/v1/messages`, and the "Claude Code with non-Anthropic models" tutorial walks through exactly this: `export ANTHROPIC_BASE_URL="http://0.0.0.0:4000"`, `export ANTHROPIC_AUTH_TOKEN="$LITELLM_MASTER_KEY"`, with `model_list` entries for OpenAI, Gemini, etc. LiteLLM "Receives requests … in Anthropic Messages API format" and "Translates the request to the target provider's format." Ollama is one of those target providers.

3. **Therefore the loop closes locally.** SDK → emits Anthropic Messages to `ANTHROPIC_BASE_URL` → LiteLLM translates to Ollama's `/api/chat` → Ollama (local model) responds → LiteLLM translates back to Anthropic format → SDK continues its tool loop. The model doing the reasoning *inside* the loop is the local one.

The honest caveat — **why this is not free**:

- **Tool-calling fidelity.** The SDK agent loop is tool-heavy (Read/Edit/Bash). LiteLLM's official Ollama docs warn: "not all ollama models support function calling, litellm defaults to json mode tool calls if native tool calling not supported." JSON-mode emulation is materially flakier than native tool use. So the local model must be a tool-capable one (e.g. Qwen2.5-Coder, Llama 3.1) and you should set `model_info: supports_function_calling: true`. Small local models will produce malformed tool calls more often than Claude does — which is exactly why the local tier must be *gated to genuinely simple, verifiable subtasks* and every result run through your verify-gate.
- **Gateway feature flags.** The official gateway doc notes you may need `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1` when a gateway serves the Anthropic format from a non-Anthropic backend, otherwise the SDK may request beta features the backend can't honor.
- **Model discovery is filtered.** Gateway `/v1/models` discovery (`CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1`) only surfaces models whose ID "begins with `claude` or `anthropic`." Your Ollama entries won't auto-appear in a `/model` picker; you select them explicitly by the `model` string (which is what cop1's orchestrator does anyway), so this is a non-issue for programmatic use.

**When to prefer a separate local executor instead.** If you find the local model's tool-call discipline too unreliable inside the full SDK loop for your hardware/model, the in-the-norms alternative is to NOT run the simple tier through the SDK at all: have the orchestrator shell out to a purpose-built local executor — **aider** (`--model ollama_chat/...`), **opencode**, or a thin script hitting **Ollama** directly — for the mechanical edit, then bring the diff back under the big-tier SDK for review. This is the pattern claude-flow's lowest tier embodies (its "Agent Booster" does sub-1ms WASM code transforms with *zero LLM call*). Both topologies are legitimate; the SDK-through-LiteLLM path is simpler and keeps one orchestration surface, while the separate-executor path trades integration simplicity for robustness on weak local models.

---

## OSS tiering patterns — how Goose, claude-flow, Cline, RooCode pick models per task/role

**Goose (block/goose) — Lead/Worker, the closest analog to cop1.** Goose has a first-class, built-in two-model mechanism. You set `GOOSE_LEAD_MODEL` (and optionally `GOOSE_LEAD_PROVIDER`) for an expensive planning model and `GOOSE_WORKER_MODEL` for a cheaper execution model. Internally a `LeadWorkerProvider` wraps two providers transparently — the caller code is unchanged; the factory detects the env vars and swaps in the wrapper. The split is **turn-count based**: `GOOSE_LEAD_TURNS` (default 3) means the lead model drives the first ~3 turns (planning/strategy), then execution hands off to the worker; there is a failure-fallback path (configurable failure threshold / fallback turns) that bounces back to the lead model when the worker repeatedly fails. **What to borrow:** the explicit "frontier model plans, cheap model executes, escalate back on repeated failure" loop. For cop1 this maps cleanly to big-Claude doing spec/decomposition, local-Ollama doing the mechanical edit, and an automatic escalation to big-Claude when the verify-gate fails N times.

**claude-flow / ruflo — three-tier complexity routing.** claude-flow analyzes task complexity and routes across three tiers: an **Agent Booster (WebAssembly)** that does simple code transforms at <1ms with **zero LLM cost**, a **medium tier** on faster models (Haiku/Sonnet), and a **complex tier** on Opus for architecture decisions (its "SONA"/LLM-router does "intelligent model selection" with quality-aware scoring). **What to borrow:** the idea that the cheapest tier may not be an LLM at all — some "simple" subtasks (rename, format, mechanical refactor) should be deterministic tooling, not even a local model call. And the explicit "quality-aware" escalation when a cheap tier's output scores poorly.

**Cline — phase/complexity routing via separate configs.** Cline doesn't hard-bind a model to Plan vs Act; instead it routes by task complexity across workflow phases, with a documented pattern of separate config directories per model (`cline --config ~/.cline-haiku` for quick tasks, `~/.cline-opus` for hard reasoning, plus a `--thinking high` flag to boost reasoning effort on hard phases). **What to borrow:** the "summary with cheap model → plan with expensive model + thinking → execute with mid-tier" phased pipeline, and using a separate config/session per tier (mirrors cop1's "two SDK sessions" option).

**RooCode — model-per-mode/role.** RooCode assigns models to **Modes** (Architect/Code/Debug/Orchestrator). The canonical example: Architect mode on a heavy reasoner (e.g. DeepSeek R1 32B), Code mode on a small coder (Qwen-2.5-Coder), and an **Orchestrator** mode that decomposes a task into subtasks and routes each to the right specialist mode/model. It explicitly supports local models "through something like LiteLLM" assigned per mode. **What to borrow:** role→model binding (your scrum roles already exist in cop1's playbook) and an orchestrator role that owns the routing decision. This is the strongest match for cop1's existing agile-role structure: bind reviewer/architect/spec roles to big-Claude and the dev-story "mechanical implementation" role to local-Ollama.

**Common thread to adopt:** (1) a single router/orchestrator owns the tier decision; (2) tier is chosen by task complexity/role, not globally; (3) the cheapest tier is sometimes non-LLM tooling; (4) there is always an automatic **escalation path** from cheap→expensive on failure or low quality. Goose's lead/worker + RooCode's role binding + a verify-gated escalation is the blend that fits cop1.

---

## LiteLLM how-to — the in-the-norms LiteLLM + Ollama setup

LiteLLM Proxy is a reverse proxy that translates a standard request format to each provider's native API and centralizes routing, load balancing, fallbacks, and spend tracking from one YAML file. For cop1 the relevant pieces are: the `model_list` (with Ollama and Claude entries), the unified Anthropic endpoint, and fallbacks.

**1. Ollama entries in `model_list`** (per LiteLLM's official Ollama provider docs):

```yaml
model_list:
  - model_name: local-coder
    litellm_params:
      model: ollama_chat/qwen2.5-coder:7b   # ollama_chat/ recommended over ollama/
      api_base: http://localhost:11434
      keep_alive: "8m"                       # keep resident between calls
    model_info:
      supports_function_calling: true
```

Two LiteLLM-documented details that matter here: the **`ollama_chat/` prefix routes to Ollama's `/api/chat` (recommended for better responses)** versus `ollama/` which hits the legacy `/api/generate`; and **tool calling** — "not all ollama models support function calling, litellm defaults to json mode tool calls if native tool calling not supported," so pick a tool-capable model and declare `supports_function_calling: true`.

**2. The unified Anthropic endpoint** is what cop1's SDK talks to. Claude Code's official LLM-gateway doc recommends LiteLLM's **unified endpoint** over pass-through:

```bash
export ANTHROPIC_BASE_URL=https://litellm-server:4000        # unified /v1/messages
export ANTHROPIC_AUTH_TOKEN=$LITELLM_MASTER_KEY
```

and lists its benefits as "Load balancing, Fallbacks, Consistent support for cost tracking and end-user tracking." (The pass-through variants — `ANTHROPIC_BASE_URL=.../anthropic`, `ANTHROPIC_BEDROCK_BASE_URL=.../bedrock`, `ANTHROPIC_VERTEX_BASE_URL=.../vertex_ai/v1` — are the alternative when you need provider-native pathing for the big tier.)

**3. Big-tier entries** (Bedrock/Vertex/Anthropic) live in the same `model_list`, so one proxy serves both tiers:

```yaml
  - model_name: big-claude
    litellm_params:
      model: bedrock/anthropic.claude-opus-4-5-20251101-v1:0
      aws_region_name: us-east-1
  - model_name: review-claude
    litellm_params:
      model: anthropic/claude-sonnet-4-5
      api_key: os.environ/ANTHROPIC_API_KEY
```

**4. Fallbacks / routing** (LiteLLM proxy config) give you the Goose-style escalation for free at the gateway layer:

```yaml
litellm_settings:
  fallbacks: [{"local-coder": ["review-claude"]}]   # local fails → cheap cloud
  num_retries: 2
```

**Security note from Anthropic's own gateway doc:** LiteLLM is a third-party proxy Anthropic "doesn't endorse, maintain, or audit," and **PyPI versions 1.82.7 / 1.82.8 were compromised with credential-stealing malware** — do not install those; pin to a known-good version and rotate credentials if you ever touched them. For an overnight unattended run this is worth pinning explicitly in cop1's bootstrap.

---

## Recommendation — recommended cop1 design for big-vs-local tiering that respects the SDK reality

**Topology: one LiteLLM proxy fronting both Ollama (local tier) and Bedrock/Vertex/Anthropic (big tier); cop1's orchestrator selects the tier per subtask by passing the right `model` name to the Claude Agent SDK.** This respects the SDK reality proven above: the SDK's agent loop genuinely runs on the local model when you name a LiteLLM→Ollama model, so you keep a single orchestration surface and don't need a parallel executor for the happy path.

Recommended specifics for cop1:

1. **Two model names, one gateway.** `local-coder` (→ `ollama_chat/qwen2.5-coder` or similar tool-capable coder) for SIMPLE, `big-claude` (Opus) for HARD reasoning/spec, `review-claude` (Sonnet) for review. Wire the SDK with `ANTHROPIC_BASE_URL=http://localhost:4000` + `ANTHROPIC_AUTH_TOKEN=$LITELLM_MASTER_KEY`. This matches the controlled-overnight-run memo's verdict to "stay in the SDK" while adding a LiteLLM→Ollama session-scoped local tier.

2. **Tier by role/complexity, Goose/RooCode style.** Bind cop1's scrum roles to tiers: architect/spec-writer/reviewer → big-Claude; dev-story *mechanical implementation* of well-specified, low-ambiguity stories → `local-coder`. Keep the tier decision in the orchestrator (RooCode "Orchestrator" pattern), not hardcoded globally.

3. **Always verify-gate the local tier, and auto-escalate.** The honest caveat (Ollama JSON-mode tool calls, weaker instruction-following) means every local-tier output must pass cop1's existing verify-gate (tests + local CI). On failure, escalate that subtask to `big-claude` — implement this both at the gateway (`fallbacks`) and at the orchestrator level (Goose-style: after N local failures, re-run the subtask on the big model). This bounds the blast radius of a flaky local model during an unattended overnight run.

4. **Keep the separate-executor path as a deliberate fallback, not the default.** If profiling shows the chosen local model can't hold the SDK tool loop reliably, switch the SIMPLE tier to a separate local executor (aider/opencode/direct-Ollama) invoked by the orchestrator, returning a diff that big-Claude reviews — the claude-flow "cheap tier need not even be an LLM-in-the-loop" insight. Decide this empirically per model/hardware; don't pre-commit.

5. **Operational guardrails for overnight.** Set `keep_alive` so the local model stays warm across many small calls; set `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1` if the SDK requests betas the backend rejects; pin a known-good LiteLLM version (avoid 1.82.7/1.82.8); and keep big-tier budget-kill independent of local-tier (local calls are free, so the budget killer should only meter Bedrock/Vertex/Anthropic spend, which LiteLLM's per-model cost tracking and the `X-Claude-Code-Session-Id` / `X-Claude-Code-Agent-Id` headers let you attribute per session/subagent).

Net: cop1 gets a real local tier *inside* the SDK loop with one config change, a Goose-style escalation for safety, and a documented escape hatch (separate executor) for weak local models — all using in-the-norms, officially-documented mechanisms.

---

## Citations

- Claude Agent SDK with LiteLLM (env vars, ClaudeAgentOptions model, agent loop runs on configured model): https://docs.litellm.ai/docs/tutorials/claude_agent_sdk
- Use Claude Code with Non-Anthropic Models via LiteLLM (`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `/v1/messages` translation, `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY`): https://docs.litellm.ai/docs/tutorials/claude_non_anthropic_models
- LiteLLM Anthropic unified `/v1/messages` endpoint (non-Anthropic providers callable through Anthropic format): https://docs.litellm.ai/docs/anthropic_unified
- LiteLLM Ollama provider (`ollama_chat/` vs `ollama/`, `api_base`, `keep_alive`, `supports_function_calling`, JSON-mode tool-call fallback caveat): https://docs.litellm.ai/docs/providers/ollama
- LiteLLM Anthropic passthrough endpoint: https://docs.litellm.ai/docs/pass_through/anthropic_completion
- LiteLLM proxy config overview (model_list, routing, fallbacks): https://docs.litellm.ai/docs/proxy/configs
- LiteLLM proxy quick start: https://docs.litellm.ai/docs/proxy/docker_quick_start
- Claude Agent SDK overview (same agent loop as Claude Code; Bedrock/Vertex/Azure auth env vars; subagents): https://code.claude.com/docs/en/agent-sdk/overview
- Claude Code LLM gateway configuration (gateway API-format requirements: Anthropic Messages/Bedrock/Vertex; `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BEDROCK_BASE_URL`, `ANTHROPIC_VERTEX_BASE_URL`; unified vs pass-through; `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS`; gateway model discovery filter; LiteLLM malware security warning for 1.82.7/1.82.8): https://code.claude.com/docs/en/llm-gateway
- Ollama: https://ollama.com / https://github.com/ollama/ollama
- Goose lead/worker model routing (`GOOSE_LEAD_MODEL`, `GOOSE_WORKER_MODEL`, `GOOSE_LEAD_PROVIDER`, `GOOSE_LEAD_TURNS` default 3, LeadWorkerProvider, failure fallback): https://github.com/block/goose/issues/4036 ; https://github.com/block/goose/issues/4040 ; https://github.com/block/goose/issues/4323 ; https://deepwiki.com/block/goose/2.2-provider-configuration
- Goose with local Ollama: https://medium.com/@balazskocsis/goose-coding-agent-with-local-ollama-model-serving-cd3895aa8570
- Cline model orchestration (phase/complexity routing, per-config model selection, `--thinking`): https://docs.cline.bot/cline-cli/samples/model-orchestration
- RooCode docs (modes Architect/Code/Orchestrator, per-mode model assignment incl. local via LiteLLM): https://docs.roocode.com/
- RooCode multi-agent workflow (Architect heavy reasoner + Code small coder, Orchestrator routing): https://xebia.com/blog/multi-agent-workflow-with-roo-code/
- claude-flow / ruflo (three-tier routing: WASM Agent Booster zero-LLM, Haiku/Sonnet mid, Opus complex; SONA quality-aware routing): https://github.com/ruvnet/ruflo/issues/945
- agentic-flow (switch Claude Code/Agent SDK to alternative low-cost models): https://github.com/ruvnet/agentic-flow
- Claude Code Router (Anthropic-format proxy routing per request type to OpenRouter/DeepSeek/Ollama/etc.): https://github.com/musistudio/claude-code-router

## Annexe F — Patterns Ralph / runners de nuit OSS

## Loop shape — the concrete Ralph loop shape from the actual code/writeups

The Ralph loop, in Geoffrey Huntley's original framing (`ghuntley.com/ralph`), is literally one line:

```bash
while :; do cat PROMPT.md | claude-code ; done
```

The insight is that **progress does not live in the LLM context window — it lives in files and git history**. Each iteration spawns a *fresh* agent instance with clean context; the only memory carried forward is (a) git commits, (b) an append-only progress log, and (c) a machine-readable task list. The context window is treated like memory allocation: "the more you use the context window, the worse the outcomes you'll get," so each iteration is deliberately kept small.

The `snarktank/ralph` `ralph.sh` is the production-grade version of that one-liner. The actual loop body (verbatim from the cloned repo):

```bash
for i in $(seq 1 $MAX_ITERATIONS); do
  # Run the selected tool with the ralph prompt
  if [[ "$TOOL" == "amp" ]]; then
    OUTPUT=$(cat "$SCRIPT_DIR/prompt.md" | amp --dangerously-allow-all 2>&1 | tee /dev/stderr) || true
  else
    OUTPUT=$(claude --dangerously-skip-permissions --print < "$SCRIPT_DIR/CLAUDE.md" 2>&1 | tee /dev/stderr) || true
  fi

  # Check for completion signal
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo "Ralph completed all tasks!"
    exit 0
  fi

  echo "Iteration $i complete. Continuing..."
  sleep 2
done

echo "Ralph reached max iterations ($MAX_ITERATIONS) without completing all tasks."
exit 1
```

The per-iteration *contract* lives entirely in `prompt.md` and is the part cop1 should study most closely. The agent is told, in order:

1. Read the PRD at `prd.json`.
2. Read the progress log `progress.txt` (the "Codebase Patterns" section *first*).
3. Verify it's on the correct branch (`branchName` from the PRD); check out / create from main if not.
4. **Pick the highest-priority user story where `passes: false`** — this is how "one task" is selected: a deterministic priority sort over a JSON array, gated by a boolean.
5. **Implement that single user story** (the prompt repeats "Work on ONE story per iteration").
6. Run quality checks (typecheck, lint, test).
7. Update `AGENTS.md` files if reusable patterns were discovered.
8. **If checks pass, commit ALL changes** with message `feat: [Story ID] - [Story Title]`.
9. Update the PRD to set `passes: true` for that story.
10. Append learnings to `progress.txt`.

So the canonical iteration is: **select-one → implement → verify → commit → mark-done → log → exit (let next fresh iteration pick up the next item).** The verify-then-commit step is explicit and conditional: "ALL commits must pass your project's quality checks… Do NOT commit broken code." For UI stories there is an additional gate — "A frontend story is NOT complete until browser verification passes" (it loads a `dev-browser` skill, navigates, and screenshots).

The stop condition is a two-level guard. The *agent-level* signal: after finishing a story, the agent checks whether **all** stories now have `passes: true`; only then does it emit the literal sentinel `<promise>COMPLETE</promise>`. The *loop-level* guard is the `for i in seq 1 $MAX_ITERATIONS` ceiling. The `<promise>` mechanism exists specifically because "Claude can't just stop talking and have the session end — it must affirmatively state the work is done," which prevents the agent from silently ending while work remains.

Task sizing is a hard rule baked into the PRD-conversion skill: **"Each story must be completable in ONE Ralph iteration (one context window)."** Rule of thumb: "If you cannot describe the change in 2-3 sentences, it is too big." Stories are ordered dependency-first (schema → backend → UI → aggregates), and every story must carry a *verifiable* acceptance criterion, always including "Typecheck passes."

## Isolation — worktree/branch/container isolation patterns

There is a clear escalation ladder of isolation strength across these tools. cop1 can pick a rung per risk tolerance.

**Ralph itself uses the weakest isolation: a single branch, no worktree.** The agent simply ensures it's on `ralph/<feature>` (from `prd.json.branchName`) and commits there. Isolation from *main* is by branch only; there is no per-iteration sandbox. `ralph.sh` adds one nicety — when `branchName` changes between runs it auto-archives the prior `prd.json`/`progress.txt` into `archive/YYYY-MM-DD-feature/` and resets the progress log, keeping runs from contaminating each other.

**uzi (devflowinc) — worktree + tmux + port per agent.** Each agent gets its own **git worktree**, its own **branch**, its own **tmux session**, and a **dev-server port** allocated from a configured range. Config is a two-field `uzi.yaml`:

```yaml
portRange: 3000-3010
devCommand: cd astrobits && yarn && yarn dev --port $PORT
```

`$PORT` is substituted per agent so N agents can all run dev servers simultaneously without collisions. You fan out with `uzi prompt --agents claude:2,codex:1 "Build a todo app"` (spawns 2 Claude + 1 Codex, each in its own worktree). `uzi ls -w` watches all sessions (name, model, status, diff, local address). `uzi checkpoint <agent> "msg"` **commits and rebases that agent's worktree changes into your current branch** — the merge-back primitive. `uzi run <cmd>` executes a command across *all* worktrees; `uzi kill all` / `uzi reset` tear down.

**claude-squad (smtg-ai) — same worktree+tmux model, review-gated merge.** "git worktrees to isolate codebases so each session works on its own branch" + "tmux to create isolated terminal sessions for each agent." Crucially it adds a human review gate before merge: Tab toggles a **preview tab vs. diff tab**; `c` commits and *pauses* the session for manual inspection; `s` commits and pushes the branch to GitHub. Background/autonomous mode is opt-in via `-y/--autoyes`.

**container-use (dagger) — the strongest: container + branch per agent.** Each agent runs in "a fresh container in its own git branch." Dual isolation: a Dagger-orchestrated **container** (filesystem/process/network sandbox) *plus* a **git branch** backing every environment, giving a persistent versioned history. The observe/intervene/merge command set is the most mature here and is the best template for cop1:
- `cu watch` — real-time stream of all agent activity (≈ `watch git log --remotes=container-use --oneline --graph`).
- `cu terminal` — drop into an agent's container to take control when it's stuck.
- `cu checkout <branch>` — pull an environment's branch into your IDE to explore.
- `cu diff` — review what an agent actually did (logged commands, not claims).
- `cu merge` — merge an environment's work into the current branch, **preserving commit history**; `cu apply` to apply changes. Discard = just drop the branch/container.

**vibe-kanban / Cline Kanban — worktree-per-task-attempt, orchestrated.** Both create a **new git worktree + dedicated branch per task (or task attempt)** when a card starts running, "which keeps the main workspace clean and prevents conflicts between concurrent tasks." Cline Kanban adds two pragmatic touches worth stealing: it **symlinks gitignored files like `node_modules`** into each ephemeral worktree to avoid re-running `npm install` per copy, and it uses **agent hooks to surface the latest message/tool-call on each card** so you can "monitor hundreds of agents at a glance." Merge-back is via commit-then-"Open PR," with the agent resolving conflicts.

**Concrete mechanics to borrow for cop1:** (1) one worktree + one branch named `<prefix>/<epic-or-task>` per unit of autonomous work; (2) a deterministic resource allocator (`$PORT` from a range) so parallel runs don't collide; (3) a single explicit *merge-back* verb that rebases/merges preserving history (`uzi checkpoint` / `cu merge`); (4) symlink heavy gitignored dirs to keep worktree spin-up cheap; (5) a watch/diff surface that shows *actual logged actions*, not the agent's self-report.

## Safety controls — budget caps, iteration caps, kill-switch, guardrails

The OSS overnight runners converge on a small set of controls, almost all of which Ralph demonstrates concretely:

- **Iteration cap as the primary budget control.** `ralph.sh` defaults to `MAX_ITERATIONS=10`; the Claude-Code Ralph plugin's `--max-iterations` flag is described explicitly as "not just a safety net; it's a budget control. Start with 10-20 iterations for well-scoped tasks." This is the single most important guardrail because a bad prompt "will loop until max iterations, burning tokens on increasingly speculative changes." A reported 50-iteration loop on a complex codebase costs "$50–100+ in API usage."
- **A completion sentinel, not silent stop.** The `<promise>COMPLETE</promise>` tag forces an affirmative, greppable done-signal. The loop only exits early when it sees that exact string — otherwise it runs to the cap. This avoids both premature exit and infinite spin.
- **Verify-gate before every commit.** "ALL commits must pass your project's quality checks… Do NOT commit broken code." Because broken code compounds across fresh-context iterations ("CI must stay green — broken code compounds"), the test/typecheck gate *is* the load-bearing safety mechanism. TDD framing is ideal: "The test suite *is* the completion criterion."
- **Per-step approval / auto-approve tiers.** Cline's auto-approve lets you whitelist *which* action classes (file edits, terminal, browser, MCP, mode transitions) run unattended while keeping high-risk actions gated; "YOLO mode" approves everything. claude-squad's `--autoyes` and uzi's `uzi auto` are the same idea — autonomy is a deliberate, named flag, not the default. cop1 should make full autonomy explicit and tiered.
- **Checkpoints / instant rollback.** Cline tracks "all changes with checkpoints, so you can easily undo the agent's work"; container-use lets you "discard an experiment instantly" by dropping the branch/container. Frequent commits (Ralph commits per story) give natural rollback points.
- **Blast-radius containment.** Huntley's framing: "it's not a question of *if* your loop gets compromised, it's *when*, and what the blast radius is." This is the argument for container-use-style sandboxing and for running overnight loops on a disposable VM (the YC team ran Ralph on a throwaway GCP instance).
- **Cost observability.** The YC hackathon run is the canonical data point: ~1,100 commits across 6 repos overnight for **~$800** (≈$10.50/hr-equivalent). A budget *kill-switch* (hard token/dollar ceiling that aborts the loop) is the obvious missing primitive that none of these implement cleanly — a gap cop1 should close, matching the "budget-kill" blocker already in cop1's controlled-overnight-run design.

## Goose patterns — recipes + scheduler for file-defined unattended jobs

Goose (block/goose) is the closest OSS analog to cop1's "playbook + night-scheduler" split, because the *unattended job is a declarative file*, and a separate scheduler fires it on cron.

**A recipe is a YAML file** that packages instructions, prompt, tools, parameters, and validation into one reusable, version-controllable unit. Full schema example (verbatim from the recipe reference):

```yaml
version: "1.0.0"
title: "Example Recipe"
description: "A sample recipe demonstrating the format"
instructions: "Process {{ file_count }} files using {{ required_param }} and output in {{ output_format }} format."
prompt: "Start processing with the provided parameters"
parameters:
  - key: required_param
    input_type: string
    requirement: required
    description: "A required text parameter"
  - key: file_count
    input_type: number
    requirement: optional
    default: 10
    description: "Maximum number of files to process"
  - key: output_format
    input_type: select
    requirement: required
    options: [json, markdown, csv]
extensions:
  - type: stdio
    name: codesearch
    cmd: uvx
    args: [mcp_codesearch@latest]
    timeout: 300
    bundled: true
settings:
  goose_provider: "anthropic"
  goose_model: "claude-sonnet-4-20250514"
  temperature: 0.7
  max_turns: 100
retry:
  max_retries: 3
  timeout_seconds: 30
  checks:
    - type: shell
      command: "echo 'Task validation check passed'"
  on_failure: "echo 'Retry attempt failed, cleaning up...'"
response:
  json_schema:
    type: object
    properties:
      result: { type: string }
      details: { type: array, items: { type: string } }
    required: [result, details]
```

Key field semantics relevant to cop1: `instructions`/`prompt` use `{{ variable }}` template substitution; `parameters` carry `input_type` (string/number/select/file), `requirement` (required/optional), and `default`; `extensions` declares the MCP servers/tools the job is allowed to use (a capability allowlist); `settings` pins provider/model/temperature/`max_turns` (a per-recipe turn cap — another budget lever); `retry` defines **shell `checks` that must pass**, a `max_retries`, a `timeout_seconds`, and an `on_failure` cleanup hook (verify-gate-as-config); and `response.json_schema` *enforces structured output*. `sub_recipes` lets one recipe delegate specialized subtasks (Ralph's "subagent" idea, declared in a file).

**Headless run:** `goose run --recipe recipe.yaml --params language=Python`. A prompt is required for non-interactive mode; "Run once and exit."

**Scheduling is a thin cron layer over the recipe.** The scheduler wraps `tokio-cron-scheduler` and persists jobs. Create one with:

```bash
goose schedule add \
  --schedule-id daily-report \
  --cron "0 0 9 * * *" \
  --recipe-source ./recipes/daily-report.yaml
```

The cron format is a 5/6/7-field expression: `seconds minutes hours day-of-month month day-of-week [year]` (note the leading seconds field). On `add`, Goose **copies the current recipe into `~/.local/share/goose/scheduled_recipes`** (so the schedule is pinned to a snapshot, not a moving file). Each fire **creates a fresh headless session**; you can list schedules, view per-run execution history, run-now, edit frequency, or pause. The takeaway for cop1: **the playbook = a parameterized recipe file with an explicit tool allowlist, a verify-gate (`retry.checks`), a turn cap, and structured output; the night-scheduler = a cron-id → recipe-snapshot binding that spawns one isolated headless session per fire.** Pinning a *snapshot* at schedule-creation time is a subtle but valuable reproducibility property.

## Pitfalls — known failure modes of overnight autonomous loops

Distilled from Huntley's `ghuntley.com/ralph`, the Ralph `prompt.md`, and the Claude-Code Ralph analyses:

1. **Bad code-search conclusions ("not implemented" false negatives).** The agent runs ripgrep, gets a miss, and re-implements something that already exists. Guardrail: "Before making changes search codebase (don't assume an item is not implemented) using parallel subagents."
2. **Placeholder / stub implementations.** Models chase the reward function (compiling/green tests) by writing stubs. Guardrail, shouted in caps: "DO NOT IMPLEMENT PLACEHOLDER OR SIMPLE IMPLEMENTATIONS. WE WANT FULL IMPLEMENTATIONS."
3. **Premature "done."** Without a forced affirmative signal the agent stops while work remains — hence the `<promise>COMPLETE</promise>` sentinel that must be earned by an all-`passes:true` check.
4. **Cost/iteration runaway.** A vague prompt with no measurable done-criterion loops to the cap "burning tokens on increasingly speculative changes" ($50–100+ for 50 iterations). Mitigations: measurable completion criteria, phased work, iteration cap as budget.
5. **Context rot — two opposite failure shapes.** Within a long single session, "a model that has been debugging for 30 iterations carries cognitive baggage from every failed approach" and may "repeat failed approaches." Ralph's fix is the *opposite extreme*: throw the context away every iteration. The cost of the fresh-context approach is **lost reasoning across loops**, mitigated by capturing "the *why* tests and the backing implementation is important" in docstrings and in `progress.txt`/`AGENTS.md`.
6. **Collateral test breakage ignored.** Narrow focus on the current story breaks unrelated tests. Guardrail: "If tests unrelated to your work fail then it's your job to resolve these tests" + "keep CI green."
7. **Over-parallelization / back-pressure.** Too many concurrent subagents degrade results. Guardrail: "up to 500 subagents for search/write but **only 1 subagent for build/tests**."
8. **Loss of learned operational knowledge.** The agent re-discovers how to build/run the project every loop. Guardrail: persist commands and conventions into `AGENT.md`/`AGENTS.md` via a subagent.
9. **Wrong-item selection / planning drift.** Without a strict priority order the loop wanders. Guardrail: a prioritized `@fix_plan.md` (or `prd.json` priority+`passes`), "periodically regenerated from scratch."
10. **Specs vs. code as source of truth.** Huntley treats `specs/` as authoritative; code is the *output*. If the spec is wrong/ambiguous, the loop confidently builds the wrong thing — so spec quality, not loop mechanics, is the real bottleneck.
11. **Slow feedback wheel.** Wrong language/slow compile reduces iteration velocity; correctness must be balanced against "the speed of the wheel turning."
12. **Judgment-heavy work is a bad fit.** Lessons from the YC run: loops shine for *batch* work (large refactors/ports, test coverage, docs, ticket triage); "judgment-heavy work still needs human-in-the-loop."

## Design primitives — concrete primitives cop1 should adopt

Mapping the above onto cop1's existing architecture (supervisor + 3-track history + 1 SDK session per epic + playbook/night-scheduler):

1. **Fresh-context-per-unit + durable file state.** Keep cop1's "memory in files, not context" discipline. Externalize state into exactly three stores, Ralph-style: a machine-readable task list (`prd.json`-equivalent: id, priority, `passes`, acceptance criteria), an append-only learnings log (`progress.txt` with a consolidated "Codebase Patterns" header read *first*), and git history. cop1's ExchangeHistoryWriter is the right place for the learnings track.
2. **Deterministic single-item selection.** Pick exactly one unit per iteration via `min(priority) where passes==false`. Forbid multi-story iterations in the supervisor prompt. Enforce story-sizing ("describable in 2–3 sentences," dependency-ordered) at PRD-conversion time.
3. **Verify-then-commit gate, conditional and non-negotiable.** No commit unless typecheck+lint+test pass; UI stories require a browser-verification sub-gate. This maps directly to cop1's existing `verify-gate` blocker and its local-CI-first principle. Use Goose's `retry.checks` shape: declarative shell checks + `on_failure` cleanup.
4. **Two-level stop condition.** Agent-level affirmative sentinel (a greppable `<promise>COMPLETE</promise>`-style token, only emitted when *all* items pass) **plus** a loop-level `MAX_ITERATIONS` cap. Neither alone is sufficient.
5. **Iteration cap *and* a hard budget kill-switch.** Adopt `--max-iterations` as the first-line budget control (start 10–20/epic), but add what the OSS tools lack: a real-time token/dollar ceiling that aborts mid-loop. This closes cop1's named "budget-kill" blocker; pair it with `max_turns`/`max-iterations` from the recipe.
6. **Worktree + branch isolation per epic, container for untrusted runs.** Default to uzi/vibe-kanban-style `worktree + branch named <prefix>/<epic>`; for overnight unattended runs, escalate to container-use-style container+branch for blast-radius containment on a disposable VM. Allocate dev ports from a range (`$PORT`) to allow parallel epics. Symlink heavy gitignored dirs (node_modules) to keep spin-up cheap.
7. **One explicit merge-back verb.** A single `checkpoint`/`merge` operation that rebases/merges the worktree into the integration branch *preserving commit history* (`uzi checkpoint` / `cu merge`), gated by the verify step and (optionally) human review like claude-squad's diff/preview tabs.
8. **Playbook = parameterized recipe file.** Encode the night-job as a Goose-style declarative file: `instructions` with `{{params}}`, an **explicit tool/MCP allowlist** (`extensions`), pinned model/`max_turns` (`settings`), a verify-gate (`retry.checks`), and structured output (`response.json_schema`). This is exactly cop1's "scrum directives, no file-level BMAD coupling" intent — directives + allowlist in one versioned file.
9. **Night-scheduler = cron-id → pinned recipe snapshot.** Bind a `schedule-id` + cron expression to a *snapshot* of the playbook (copy at schedule-creation, Goose-style) so overnight runs are reproducible even if the playbook later changes; each fire spawns one isolated headless session.
10. **Anti-stub + search-before-build directives in the supervisor prompt.** Carry Ralph's caps-locked "no placeholder implementations" and "search the codebase before assuming not-implemented (via subagents)" verbatim; constrain build/test to a single subagent to avoid back-pressure.
11. **Observability of *actual* actions.** Surface logged commands/diffs (container-use "what agents actually did, not what they claim") and a per-unit status line (Cline's hook-driven card status) so a human can audit an overnight run quickly. cop1's 3-track history already aligns; add a `watch`/diff surface.
12. **Tiered autonomy as an explicit, named mode.** Full unattended autonomy should be a deliberate flag (`--autoyes`/YOLO/`uzi auto`) with action-class allowlisting (Cline auto-approve), never the default — matching cop1's "stops between sprints, alerts on drift" posture.

## Citations

- Geoffrey Huntley, "Ralph Wiggum as a software engineer" — https://ghuntley.com/ralph/
- Geoffrey Huntley, "everything is a ralph loop" — https://ghuntley.com/loop/
- snarktank/ralph (repo; cloned and read `ralph.sh`, `prompt.md`, `prd.json.example`, `skills/ralph/SKILL.md`, `README.md`) — https://github.com/snarktank/ralph
- snarktank/ralph `ralph.sh` — https://github.com/snarktank/ralph/blob/main/ralph.sh
- Anthropic Claude Code Ralph-Wiggum plugin — https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum
- Shiqi Mei, "The Ralph Wiggum Loop" (Claude Code analysis, failure modes, max-iterations as budget) — https://shiqimei.github.io/posts/ralph-wiggum-loop-claude-code
- "We put a coding agent in a while loop" (YC hackathon, 1,100 commits / 6 repos / ~$800) — https://news.ycombinator.com/item?id=45005434
- Goose Recipe Reference (full YAML schema + example) — https://block.github.io/goose/docs/guides/recipe-reference/ and https://goose-docs.ai/docs/guides/recipes/recipe-reference/
- Goose Recipes overview / headless `goose run --recipe` — https://block.github.io/goose/docs/guides/recipes/ and https://goose-docs.ai/docs/guides/recipes/session-recipes/
- Goose Sub-Recipes — https://block.github.io/goose/docs/guides/recipes/sub-recipes/
- Goose Scheduler & Recurring Tasks (`goose schedule add`, tokio-cron-scheduler, `~/.local/share/goose/scheduled_recipes`) — https://deepwiki.com/block/goose/4.1.5-scheduler-and-recurring-tasks
- devflowinc/uzi (worktree + tmux + `$PORT`, `uzi prompt/ls/auto/checkpoint/run/kill/reset`, `uzi.yaml`) — https://github.com/devflowinc/uzi
- smtg-ai/claude-squad (worktree + tmux, `--autoyes`, diff/preview review gate) — https://github.com/smtg-ai/claude-squad
- dagger/container-use (container+branch isolation; `cu watch/terminal/checkout/diff/merge/apply`) — https://container-use.com/ , CLI reference https://container-use.com/cli-reference , repo https://github.com/dagger/container-use
- Dagger blog, "Containing Agent Chaos" — https://dagger.io/blog/agent-container-use/
- BloopAI/vibe-kanban (worktree-per-task-attempt, executor abstraction, diff review + one-click merge) — https://github.com/BloopAI/vibe-kanban , https://deepwiki.com/BloopAI/vibe-kanban
- Starlog, "Vibe Kanban: The Git Worktree Strategy" — https://starlog.is/articles/ai-dev-tools/bloopai-vibe-kanban/
- cline/kanban (ephemeral worktree per card, linked cards/dependency chains, auto-commit, node_modules symlink, hook-driven card status) — https://github.com/cline/kanban
- Cline auto-approve / YOLO mode docs — https://docs.cline.bot/features/auto-approve
- Cline blog, "20 one-shot prompts that turn Kanban into an autonomous coding machine" — https://cline.bot/blog/20-one-shot-prompts-that-turn-kanban-into-an-autonomous-coding-machine
