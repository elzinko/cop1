# Sprint Change Proposal — LLM Observability & Invocation History

**Date:** 2026-02-19
**Author:** elzinko (via Correct Course workflow)
**Status:** Approved
**Scope:** Minor — Direct implementation by dev team

---

## 1. Issue Summary

**Problem:** When cop1 runs a sprint with real LLM agents (Ollama), LLM calls pass silently through `LLMGateway` without emitting any event. There is zero visibility on: which models are called, when, for how long, and how many tokens are consumed.

**Discovery Context:** Identified during Sprint 6 implementation (E3-S16 Wire Real Agents + E5-S8 LLM Agent Adapters). The components needed for observability (`EventBus`, `LoggerBridge`, `TokensPerSecMonitor`, `OllamaManagementAdapter`, `SprintFormatter`) all exist and are implemented — but none are wired to the LLM call pipeline.

**Evidence:**
- `LLMGateway` constructor takes only `LLMProvider` — no `EventBus` injection
- `LoggerBridge.TRACKED_EVENTS` contains only workflow events (`story.*`), not LLM events
- `TokensPerSecMonitor` is never instantiated outside its own test file
- `OllamaManagementAdapter` is not referenced in any CLI command
- `SprintFormatter` displays `dev ok` without model name, duration, or token count

**Feature Brief:** `features/llm-observability.md`

---

## 2. Impact Analysis

### Epic Impact

| Epic | Impact | Details |
|------|--------|---------|
| **E5 — LLM Infrastructure** | Modified | Add 4 new stories (E5-S9 through E5-S12) for event emission, logging, monitoring wiring, and CLI integration |
| **E11 — Monitoring & Web UI** | Modified | Add 1 new story (E11-S13) for real-time LLM display in SprintFormatter |
| E3 — Sprint Engine Core | None | No changes needed — SprintRunner already passes EventBus |
| E6 — LLM Provisioning | Benefit | OllamaManagementAdapter wiring enables future provisioning features |
| E8 — Ceremony Engine | Benefit | TokensPerSecMonitor wiring enables NFR2 ceremony eligibility checks |

### Story Impact

No existing stories are modified. 5 new stories are added.

### Artifact Conflicts

- **PRD:** No conflict. Fills gaps in FR29 (structured JSON logging), FR52 (tokens/sec measurement), NFR17 (all system events logged)
- **Architecture:** No conflict. Uses existing patterns: EventBus pub-sub, dot-notation events (`llm.call.started`, `llm.call.completed`), hexagonal injection
- **UI/UX:** N/A — CLI-only impact (SprintFormatter)

### Technical Impact

- `LLMGateway` signature changes: optional `EventBus` parameter added to constructor (backward compatible)
- `SprintRunner.buildRealSteps()` passes `this.eventBus` to `LLMGateway` constructor
- `LoggerBridge.TRACKED_EVENTS` gains 2 entries
- `sprint-status.ts` gains Ollama model listing

---

## 3. Recommended Approach

**Path:** Direct Adjustment — add stories within existing epic structure

**Rationale:**
- All components are already implemented and tested in isolation
- Only wiring/integration work is needed — no new architecture
- EventBus pattern is proven throughout the codebase (WorkflowEngine, SprintRunner, etc.)
- Fits naturally in Sprint 6 which already wires real LLM agents

**Effort:** Low (10 Fibonacci points total)
**Risk:** Low — backward-compatible changes, existing patterns
**Timeline Impact:** None — stories run in parallel with current Sprint 6 work

---

## 4. Detailed Change Proposals

### Story: [E5-S9] LLMGateway Event Emission
> **3 pts** | Must Have | Blocked by: E5-S1, E3-S16

**Package:** `@cop1/llm-intelligence`

- **AC1:** `LLMGateway` accepts an optional `EventBus` in its constructor — `new LLMGateway(provider, eventBus?)`. When present, every `complete()` and `completeForAgent()` call emits `llm.call.started` (before streaming) and `llm.call.completed` (after full `AsyncIterable` consumption)
- **AC2:** The `llm.call.completed` payload contains: `{ model, agentType, promptLength, responseLength, durationMs, tokenCount }` — `tokenCount` is estimated as `responseLength / 4` (chars/4 approximation, sufficient for MVP)
- **AC3:** If no EventBus is provided, LLMGateway works exactly as before (full backward compatibility — no existing test breaks)

**Files:**
- `packages/llm-intelligence/src/features/llm-gateway/application/LLMGateway.ts` — modify constructor + wrap `complete()`/`completeForAgent()`
- `packages/app/src/composition/SprintRunner.ts:218` — pass `this.eventBus` to LLMGateway constructor

**Dev Notes:**
- The `complete()` method returns `AsyncIterable<LLMChunk>`. To emit `llm.call.completed`, wrap the iterable in a generator that tracks text length and timing, then emits the event when `done: true` is received.
- `agentType` for `complete()` (direct call) should be `'direct'`; for `completeForAgent()` it should be the `commandType` parameter.

---

### Story: [E5-S10] LoggerBridge LLM Event Tracking
> **1 pt** | Must Have | Blocked by: E5-S9

**Package:** `@cop1/observability`

- **AC1:** `TRACKED_EVENTS` in LoggerBridge includes `'llm.call.started'` and `'llm.call.completed'` — LLM events are written to the sprint-log JSONL with the same format as existing workflow events
- **AC2:** After a sprint with real Ollama agents, the file `.cop1/sprint-log-{date}.jsonl` contains `llm.call.completed` entries with model, durationMs and tokenCount verifiable by grep

**Files:**
- `packages/observability/src/features/logger/application/LoggerBridge.ts` — add 2 entries to `TRACKED_EVENTS` array

---

### Story: [E5-S11] TokensPerSecMonitor Wiring
> **2 pts** | Must Have | Blocked by: E5-S9

**Package:** `@cop1/app` (composition)

- **AC1:** `TokensPerSecMonitor` is instantiated in `SprintRunner.buildRealSteps()` and subscribes to `llm.call.completed` via EventBus — each LLM completion automatically calls `record(agentType, tokenCount, durationMs)`
- **AC2:** `TokensPerSecMonitor.measure(agentName)` returns real measurements after at least 1 LLM call — verified by integration test with mock EventBus emitting a `llm.call.completed`

**Files:**
- `packages/app/src/composition/SprintRunner.ts` — instantiate `TokensPerSecMonitor`, subscribe to EventBus

---

### Story: [E11-S13] SprintFormatter LLM Display
> **2 pts** | Should Have | Blocked by: E5-S9

**Package:** `@cop1/app`

- **AC1:** During a sprint, SprintFormatter displays LLM calls inline:
  ```
  [E3-S16] dev (mistral:7b 2.3s 156t) ok reviewer (mistral:7b 1.1s 89t) ok -> done
  ```
  Format: `step (model duration tokens) status`
- **AC2:** If no `llm.call.completed` events are emitted (tests without LLM), display falls back to current format without LLM info: `dev ok reviewer ok -> done` (backward compatible)

**Files:**
- `packages/app/src/cli/formatters/SprintFormatter.ts` — add `llm.call.completed` listener, buffer LLM info per storyId, display before step "ok"

**Dev Notes:**
- Buffer strategy: on `llm.call.completed`, store `{ model, durationMs, tokenCount }` keyed by `storyId + agentType`. On `story.step.completed`, if buffer has LLM data for that step, display it inline before "ok". Clear buffer after display.

---

### Story: [E5-S12] Ollama Models in Sprint Status
> **2 pts** | Should Have | Blocked by: E5-S1

**Package:** `@cop1/app`

- **AC1:** `cop1 sprint status` displays an "Ollama Models" section with available models (name, size in GB) via `OllamaManagementAdapter.listModels()`
- **AC2:** If Ollama is unavailable, the section displays `Ollama: unavailable` without crashing — the command always shows the rest of sprint status

**Files:**
- `packages/app/src/cli/commands/sprint-status.ts` — add call to `OllamaManagementAdapter.listModels()` and display section

---

## 5. Implementation Handoff

### Scope Classification: Minor

All changes are direct implementation by the dev team. No backlog reorganization or architectural replan needed.

### Sprint Ordering Update

**Sprint 6 — Real Agent Wiring, Worktree Execution & LLM Observability**
1. E1-S6 (cop1.config.yaml for M3 Max)
2. E5-S8 (LLM Agent Adapters — LLMCodeGenerator + LLMReviewer)
3. E3-S16 (Wire Real Agents in SprintRunner)
4. E3-S15 (Worktree Execution Mode)
5. **E5-S9 (LLMGateway Event Emission)** — NEW, pivot story
6. **E5-S10 (LoggerBridge LLM Event Tracking)** — NEW
7. **E5-S11 (TokensPerSecMonitor Wiring)** — NEW
8. **E11-S13 (SprintFormatter LLM Display)** — NEW
9. **E5-S12 (Ollama Models in Sprint Status)** — NEW

### Dependency Graph

```
E5-S9 (LLMGateway events) ──┬──> E5-S10 (LoggerBridge)
                             ├──> E5-S11 (TokensPerSecMonitor)
                             └──> E11-S13 (SprintFormatter)
E5-S1 (LLM Gateway) ────────────> E5-S12 (Ollama in sprint status)
```

### Success Criteria

- After a `cop1 sprint run --simulate`, the `.cop1/sprint-log-*.jsonl` file contains `llm.call.completed` events with model, durationMs, tokenCount
- The CLI output during sprint shows model name and duration inline per step
- `cop1 sprint status` shows available Ollama models
- All existing tests continue to pass (backward compatibility)

### Points Summary

| Story | Points | Priority |
|-------|--------|----------|
| E5-S9 | 3 | Must Have |
| E5-S10 | 1 | Must Have |
| E5-S11 | 2 | Must Have |
| E11-S13 | 2 | Should Have |
| E5-S12 | 2 | Should Have |
| **Total** | **10** | |
