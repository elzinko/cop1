---
title: 'Web UI — auth check, login & run launcher'
slug: 'web-ui-auth-and-run-launcher'
created: '2026-06-21'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['vite', 'react-18', 'node-http-daemon', 'sse', 'claude-agent-sdk', 'eventbus', 'vitest']
files_to_modify:
  ['packages/app/src/features/daemon/infrastructure/HttpServer.ts',
   'packages/app/src/features/daemon/application/DaemonService.ts',
   'packages/app/src/cli/daemon-entry.ts',
   'packages/app/src/cli/commands/orchestrator.ts',
   'packages/app/src/features/daemon/__tests__/HttpServer.test.ts',
   'packages/web/src/App.tsx']
files_to_create:
  ['packages/app/src/features/daemon/infrastructure/AuthChecker.ts',
   'packages/app/src/features/orchestrator/infrastructure/HttpOrchestratorAdapter.ts',
   'packages/web/src/AuthPanel.tsx',
   'packages/web/src/OrchestratorRunView.tsx']
code_patterns:
  ['req.method+req.url string routing -> res.end(JSON)',
   'chunked POST body parse w/ MAX_BODY_SIZE (handleRuleProposalPatch)',
   'setEventBus monkey-patches emit -> broadcastSSE(sseClients)',
   'frontend EventSource(/events) + relative fetch(/api)',
   'lazy-loaded query() via loadSdkQuery()']
test_patterns:
  ['setEventBus/setProvider DI on HttpServer',
   'createMockQuery async-generator of SDKMessage',
   'fake BMADCommandRunner returning {success,nextStatus}',
   'fetch against started server on a test port']
---

# Tech-Spec: Web UI — auth check, login & run launcher

**Created:** 2026-06-21

## Overview

### Problem Statement

cop1 is CLI-only today. A solo operator has no easy way to (1) confirm they are
authenticated to Claude — and on which model — *before* spending tokens, nor to
(2) launch an orchestrator run with its options and *watch what is happening*
live. The existing `@cop1/web` app is half-dead: its Projects/Agents/Tasks tabs
call `/api/projects|agents|tasks` endpoints that were removed in the Phase-A
pivot; only the Rules tab still works.

### Solution

Add a small local web surface (extending `@cop1/web`, served by the existing
daemon HTTP server) with two capabilities:
1. an **auth panel** that verifies the Claude connection and shows the active
   model (cheap 1-token call), and optionally triggers a real login;
2. a **run launcher** that exposes the orchestrator options as a form, spawns a
   real run, and streams its live status to the browser over SSE.

### Scope

**In Scope — POC = Story A + Story B:**
- **(A) Auth check** — backend `GET /api/auth/check`: a minimal Agent-SDK call
  (`maxTurns: 1`) returning `{ ok, model }`; UI auth panel as a **traffic light**
  (🟢 connected + model / 🔴 not connected). This alone satisfies "verify it works".
- **(B) Run launcher + live mission-control** — backend
  `POST /api/orchestrator/run` runs the orchestrator **in-process inside the
  daemon** (shared `EventBus`). It returns `{ sessionId }` **immediately**
  (fire-and-forget); the run executes in the background and all `orchestrator.*` /
  `session.*` events (**tagged with `sessionId`**) stream to the browser over the
  existing `/events` SSE. Options exposed: `--epic`, **mode `normal` or
  `abort-on-escalation`** (step-by-step deferred — see Out of Scope), env caps
  `COP1_MAX_TOKENS` / `COP1_DEADLINE_MIN` / `COP1_MAX_USD_PER_SESSION` /
  `COP1_WORKTREE_ISOLATION`. **One run at a time** (a 2nd POST → 409). UI = form
  (options visible) + a live **mission-control** view: current story/command,
  **token/$ gauge vs cap**, **escalations surfaced loudly**, a **heartbeat** so a
  long silent command doesn't look frozen, and a **STOP button** that writes
  `.cop1/abort` (reusing the existing budget kill-switch).
- New view(s) added to `@cop1/web`; daemon `HttpServer` extended.

**In Scope — later / optional:**
- **(C) Login trigger** — backend `POST /api/auth/login` runs `claude setup-token`
  (OAuth browser flow) and stores the token; UI "Se connecter" button. Heaviest
  slice (browser + token storage); **deferred** — the auth-check (A) already
  covers "verify it works", so C is only needed for from-scratch onboarding.

**Out of Scope:**
- Fixing or removing the dead Projects/Agents/Tasks tabs (leave them as-is).
- Multi-user, remote, or hosted deployment (local-first, single operator).
- Editing the playbook or managing the backlog from the UI.
- Tier-B local-LLM (LiteLLM/Ollama) configuration from the UI.
- **Step-by-step mode from the UI** — needs a web approval channel (an
  `/api/orchestrator/approve` endpoint replacing `COP1_APPROVAL_FILE` / TTY);
  deferred. The POC launcher uses `normal` / `abort-on-escalation` only.

## Context for Development

### Codebase Patterns

- **Routing** (`HttpServer.ts`): manual `if (req.method === 'X' && req.url === '/path')`
  → `res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify(...))`.
  POST body via chunked accumulation (`req.on('data')`) + a `MAX_BODY_SIZE` guard +
  `JSON.parse` — mirror `handleRuleProposalPatch`.
- **SSE bridge** (`HttpServer.setEventBus`): it **wraps `eventBus.emit`** so EVERY
  emit is also `broadcastSSE`'d to `sseClients: Set<ServerResponse>`. ⇒ if the run
  uses the **daemon's** EventBus, `orchestrator.*`/`session.*` events auto-stream to
  `/events` with **zero extra wiring**. Frontend consumes via
  `new EventSource('/events')` (see `RuleProposalsView.tsx`).
- **Frontend** (`packages/web`): Vite + React 18, relative `fetch('/api/...')`;
  Vite dev proxies `/api` + `/events` to the daemon (port 4242). Build → `dist/`
  (not served by the daemon today — dev uses the Vite server).
- **SDK call** (`AgentSdkSessionAdapter`): `query({prompt, options})`, **lazy-loaded**
  via `loadSdkQuery()`; auth inherited from env. Minimal auth-check =
  `query({prompt:'ok', options:{maxTurns:1, allowedTools:[]}})`, read the `result`
  message for the model.
- **Run wiring** (`orchestrator.ts`): `orchestratorRunCommand({epic, stepByStep,
  abortOnEscalation, projectRoot, runner})` builds `RunBudget` from env
  (`COP1_MAX_TOKENS`/`COP1_DEADLINE_MIN`/`COP1_MAX_USD_PER_SESSION`) +
  `createAbortFilePredicate('.cop1/abort')`. The run endpoint reuses this verbatim.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `packages/web/src/App.tsx` | Tabbed shell to extend with the new view |
| `packages/web/src/RuleProposalsView.tsx` | Working view + fetch pattern to mirror |
| `packages/app/src/features/daemon/infrastructure/HttpServer.ts` | Add `/api/auth/check`, `/api/auth/login`, `/api/orchestrator/run`; reuse `/events` SSE |
| `packages/app/src/cli/commands/orchestrator.ts` | Source of truth for run options/env (`RunBudget`, abort-file); the launcher reuses it |
| `packages/sprint-core/.../AgentSdkSessionAdapter.ts` | `query()` + `loadSdkQuery()` pattern for the cheap auth-check |
| `packages/app/src/features/daemon/application/DaemonService.ts` | Make it own an `EventBus` and call `httpServer.setEventBus(it)` |
| `packages/app/src/features/daemon/__tests__/HttpServer.test.ts` | DI test pattern (`setEventBus`, started-server fetch) to mirror |
| `packages/shared-kernel/.../events/domain/EventBus.ts` | The bus instance shared between daemon SSE and the run |
| `packages/web/vite.config.ts` | Dev proxy `/api` + `/events` → daemon :4242 |

### Technical Decisions

- The API key / OAuth token stays **server-side** (daemon); never sent to the
  browser. The browser only sees `{ ok, model }` and run status.
- The auth-check reuses the Agent SDK (same auth cop1 already inherits) with a
  trivial prompt + `maxTurns: 1` to keep cost ≈ nil.
- **Run in-process (party-mode decision):** for the POC the daemon runs the
  orchestrator **inside its own process** so it shares the in-memory `EventBus`
  — `orchestrator.*`/`session.*` → SSE is then almost free, no subprocess/IPC.
  Trade-off: a run crash can take the daemon down — acceptable for a local POC,
  revisit (subprocess + IPC) if it hurts.
- **STOP = abort-file (party-mode decision):** the STOP button writes
  `.cop1/abort`; the orchestrator's existing budget kill-switch picks it up and
  stops cleanly. No process-killing, no new mechanism — reuses shipped work.
- **Testability:** inject a fake Agent-SDK (auth-check) and a fake run-launcher
  so endpoints are unit-testable with no real Claude call and no real run.
- **EventBus injection = THE load-bearing refactor (Step-2 finding):** today the
  daemon has no `EventBus` and `orchestratorRunCommand` creates its own — so SSE
  sees nothing. Fix: `DaemonService` owns one `EventBus`, passes it to
  `httpServer.setEventBus(...)`, and the run endpoint injects that same bus into
  the `OrchestratorService` it builds. Then SSE streaming is free.
- **Abort-file cleanup (Step-2 finding):** the run endpoint / STOP writes
  `.cop1/abort`; it MUST be deleted once the run stops, else it aborts the next run.
- **SDK lazy-load:** the auth-check reuses `AgentSdkSessionAdapter.loadSdkQuery()`
  (the SDK is dynamically imported) rather than importing the SDK at module top.
- **SPA serving deferred:** dev runs the Vite server (proxy → daemon); serving the
  built SPA from the daemon (static fallback to `index.html`) is a later nicety,
  out of the POC.
- **Async run contract (party-mode):** `POST /api/orchestrator/run` returns
  `{ sessionId }` immediately and runs in the background; SSE events carry the
  `sessionId` for correlation. The daemon runs **one** orchestrator at a time
  (concurrent POST → 409).
- **Abort-file purged at run start:** delete `.cop1/abort` when a run starts (not
  only when it stops), so a stale file never kills a fresh run.
- **Auth-check model spike (story A):** confirm how to read the real model from
  the SDK `result` (`usage`/`modelUsage`) or echo the configured tier — resolve
  this in story A, don't discover it while coding.

## Implementation Plan

Two stories, sequenced A → B. Each is one PR (sprint-builder loop).

### Adversarial Review — Resolutions (R1, 2026-06-21)

R1 was run from a **stale local `main` (@89f841d, pre-#6)** — verify here against
`origin/main` (which HAS the #6 budget/abort hardening). One finding was an artifact;
the rest are real and resolved below.

- **Tree divergence (was "C1", artifact):** `RunBudget`, `createAbortFilePredicate`, the
  `COP1_*` caps and `.cop1/abort` DO exist on `origin/main` (`orchestrator.ts:88-91`).
  **Resolution:** implement against `origin/main` (or a branch off it); confirm
  `packages/app/src/features/orchestrator/domain/RunBudget.ts` exists before starting.
- **F1 — `loadSdkQuery` is `private static`:** `AuthChecker` does its **own** dynamic
  `import('@anthropic-ai/claude-agent-sdk')`; it does NOT call the adapter's private method.
  No change to `AgentSdkSessionAdapter`.
- **F2 — `orchestratorRunCommand` awaits the run + sets `process.exitCode`:** see new
  **Task B0** — extract the wiring into `buildOrchestratorRun()` that does not touch
  `process.exitCode`; the endpoint starts it without awaiting and returns immediately.
- **F3 — no run-level id:** the id is a **`runId` (randomUUID) generated by
  `HttpOrchestratorAdapter`**, which tags the events it forwards to SSE. `OrchestratorService`
  is not modified.
- **F4 — `setEventBus` re-entrancy:** make `HttpServer.setEventBus` **idempotent**
  (`eventBusWired` flag) so a re-call never double-wraps `emit`.
- **F5 — model source:** read the model from the SDK **`system`/init** message
  (`SDKSystemMessage.model`), not the `result` message (which has no `model` field).
- **F6 — token/$ gauge source:** sum `tokensUsed` from **`session.workflow.completed`**
  (wired in #6), not `session.turn.completed` (emits `undefined`).
- **F7 — composition:** **`DaemonService`** builds `AuthChecker` + `HttpOrchestratorAdapter`
  and calls `setAuthChecker(...)` / `setOrchestratorAdapter(...)` on the `HttpServer`.
- **F8 — mode validation:** `POST /api/orchestrator/run` rejects any `mode` other than
  `normal` / `abort-on-escalation` with `400`.
- **AC clarifications:** AC-B1 returns `{ runId }`; AC-B4/B5 filter/observe by `runId`;
  AC-B5 "stop observed" = a `run.completed` with `aborted:true` (budget path also emits
  `orchestrator.run.aborted`).

### Story A — Auth check + traffic-light panel (S)

**Tasks**

- [ ] A1: Minimal auth-check backend function.
  - File: `packages/app/src/features/daemon/infrastructure/AuthChecker.ts` (new)
  - Action: export `checkAuth(queryFn?): Promise<{ ok: boolean; model: string | null; error?: string }>`. Do its **own** `const { query } = await import('@anthropic-ai/claude-agent-sdk')` (do NOT call the adapter's `private static loadSdkQuery` — **F1**), or use the injected `queryFn` in tests. Run `query({ prompt:'respond ok', options:{ maxTurns:1, allowedTools:[], systemPrompt:{ type:'preset', preset:'claude_code' } } })`. Read the model from the **`system`/init message** (`SDKSystemMessage.model`) — NOT the `result` message (**F5**). On any throw return `{ ok:false, model:null, error }`.
  - Notes: never log/return the API key.
- [ ] A2: Wire `GET /api/auth/check`.
  - File: `packages/app/src/features/daemon/infrastructure/HttpServer.ts`
  - Action: add `if (GET && url === '/api/auth/check')` → call the injected checker → `res.writeHead(200, json); res.end(JSON.stringify({ ok, model }))`. Add a `setAuthChecker(fn)` DI setter (mirror `setRuleProposalProvider`).
  - Notes: always `200` (even on `ok:false`) so the UI renders red cleanly; key never in the body.
- [ ] A3: Auth panel UI (traffic light).
  - File: `packages/web/src/AuthPanel.tsx` (new) + wire a "Connexion" section into `packages/web/src/App.tsx`
  - Action: button "Tester la connexion" → `fetch('/api/auth/check')` → 🟢 + `model` when `ok`, 🔴 + `error` otherwise.
- [ ] A4: Tests.
  - Files: `daemon/__tests__/HttpServer.test.ts` (endpoint with a fake checker), `AuthChecker` unit test (`createMockQuery` result message), `AuthPanel.test.tsx` (testing-library).

**Acceptance Criteria**

- [ ] AC-A1: Given valid creds in the daemon env, when `GET /api/auth/check`, then `200 { ok:true, model:<name> }`.
- [ ] AC-A2: Given the SDK call throws (missing/invalid creds), when `GET /api/auth/check`, then `200 { ok:false, error:<msg> }` (not 500) and the response contains no API key.
- [ ] AC-A3: Given the auth panel, when "Tester la connexion" is clicked, then `ok:true` shows a green indicator + model, and `ok:false` shows a red indicator + error.
- [ ] AC-A4 (edge): Given the `result` message exposes no model field, when `checkAuth` runs, then it returns the configured default tier name (no crash) with `ok:true`.

### Story B — Run launcher + live mission-control (M)

**Tasks**

- [ ] B1: DaemonService owns an `EventBus` and wires SSE.
  - File: `packages/app/src/features/daemon/application/DaemonService.ts`
  - Action: `this.eventBus = options.eventBus ?? new EventBus()`; call `this.httpServer.setEventBus(this.eventBus)` on start; expose it to the run endpoint. **Load-bearing change.**
- [ ] B0: Extract reusable run wiring (**F2**).
  - File: `packages/app/src/cli/commands/orchestrator.ts`
  - Action: refactor the resolver/gate/runner/budget build (~lines 64-92) into an exported `buildOrchestratorRun(opts): { run: () => Promise<OrchestratorRunResult> }` that does NOT set `process.exitCode` / `console.*`. `orchestratorRunCommand` keeps its CLI behavior by calling it. Keep tests green.
- [ ] B2: In-process single-run adapter.
  - File: `packages/app/src/features/orchestrator/infrastructure/HttpOrchestratorAdapter.ts` (new)
  - Action: `startRun({ epic, mode, projectRoot }, eventBus): { runId }` — generate `runId = randomUUID()` (**F3**); reject if a run is already active (caller → 409); **purge `.cop1/abort`** at start; call `buildOrchestratorRun(...)` with the injected `eventBus`; **tag forwarded events with `runId`** (the browser filters on it); start `run()` **without awaiting** and return `{ runId }` immediately (**F2**); clear the active flag on terminal events (`orchestrator.run.completed`, incl. `aborted:true`, and the budget `orchestrator.run.aborted`) **and on error**. `stop()` writes `.cop1/abort`.
  - Notes: inject a fake `buildOrchestratorRun` / runner for tests.
- [ ] B3: Wire `POST /api/orchestrator/run` + `POST /api/orchestrator/stop`.
  - File: `packages/app/src/features/daemon/infrastructure/HttpServer.ts`
  - Action: parse JSON body `{ epic, mode }` (mirror `handleRuleProposalPatch`); `400` if no `epic`; call `adapter.startRun` → `200 { sessionId }` or `409` if active; stop → `adapter.stop()` → `200`. Add `setOrchestratorAdapter(fn)` DI setter.
- [ ] B4: Mission-control UI.
  - File: `packages/web/src/OrchestratorRunView.tsx` (new) + wire into `App.tsx`
  - Action: form (epic, mode select `normal`/`abort-on-escalation`, caps inputs) → POST run → `new EventSource('/events')` filtered by `sessionId` → render current story/command, **token/$ gauge vs cap**, **escalations highlighted**, **heartbeat** ("en cours…" when idle > N s), **STOP** button → POST stop.
- [ ] B5: Tests.
  - Files: `HttpServer.test.ts` (fake adapter: 200 `{sessionId}`, 409 on 2nd, 400 no epic; fake-emitted events reach SSE), `HttpOrchestratorAdapter` test (fake runner + eventBus → events tagged, single-run guard, abort purge), `OrchestratorRunView.test.tsx`.

**Acceptance Criteria**

- [ ] AC-B1: Given no active run, when `POST /api/orchestrator/run { epic:'X', mode:'normal' }`, then `200 { sessionId }` returns immediately and the run starts in the background.
- [ ] AC-B2: Given a run already active, when a 2nd `POST /api/orchestrator/run`, then `409`.
- [ ] AC-B3: Given a body without `epic`, when `POST /api/orchestrator/run`, then `400`.
- [ ] AC-B4: Given a run emitting `orchestrator.*` / `session.*` on the daemon's `EventBus`, when the browser is subscribed to `/events`, then those events (tagged with `sessionId`) are received and the current story/command is rendered.
- [ ] AC-B5: Given a run in progress, when STOP is clicked, then `.cop1/abort` is written and the run stops cleanly (a `run.aborted` event is observed) and the active flag resets.
- [ ] AC-B6 (edge): Given a stale `.cop1/abort` from a previous run, when a new run starts, then the file is purged at start so the new run is not immediately aborted.
- [ ] AC-B7 (UX): Given no events for N seconds during a long command, when mission-control renders, then a heartbeat / "en cours…" indicator is shown (no frozen screen).

## Additional Context

### Dependencies

- Daemon running (`cop1 start`); the Vite dev server proxies `/api` + `/events`.
- Valid Claude credentials in the daemon's environment (API key or OAuth token).
- Existing wiring reused as-is: `RunBudget`, `createAbortFilePredicate`,
  `orchestratorRunCommand`, `HttpServer.setEventBus` SSE bridge, `EventBus`.
- `@anthropic-ai/claude-agent-sdk` (already a dependency).

### Testing Strategy

- **Unit**: `AuthChecker` (mock `query`), `HttpOrchestratorAdapter` (fake runner +
  `EventBus`), endpoints (fake checker/adapter), React views (testing-library,
  mirror `RuleProposalsView.test.tsx`).
- **Integration**: `POST /run` → a fake run emits `orchestrator.*` on the daemon
  bus → assert the events arrive on `/events` (SSE).
- **Manual**: `cop1 start` → open the SPA → "Tester la connexion" → launch a tiny
  epic in `abort-on-escalation` with low caps → watch mission-control → STOP.

### Notes

- **Risk (load-bearing)**: if the run keeps creating its own `EventBus`, SSE stays
  empty — the daemon's bus MUST be injected into the run (Task B1/B2).
- **Risk**: the single-run flag must reset on completion AND failure/abort, else the
  daemon stays stuck "busy".
- **Risk**: purge `.cop1/abort` at run start AND after STOP.
- **Risk (spike)**: model extraction from the SDK `result` (Task A1).
- **Accepted POC trade-off**: an in-process run crash can take the daemon down.
- **Deferred (out of scope)**: Story C (real login / `claude setup-token`),
  step-by-step from the UI (needs an approval endpoint), serving the built SPA from
  the daemon.
- **Sequence**: A (auth-check, S) → B (launcher + mission-control, M). One PR each.
