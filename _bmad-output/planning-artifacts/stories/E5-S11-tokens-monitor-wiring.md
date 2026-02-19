# Story E5.S11: TokensPerSecMonitor Wiring

Status: ready-for-dev

## Story

As a Developer,
I want TokensPerSecMonitor to automatically record measurements from real LLM calls,
so that performance data is available for ceremony eligibility checks (NFR2: 15 t/s minimum).

## Acceptance Criteria

1. `TokensPerSecMonitor` is instantiated in `SprintRunner.buildRealSteps()` and subscribes to `llm.call.completed` via EventBus — each LLM completion automatically calls `record(agentType, tokenCount, durationMs)`.
2. `TokensPerSecMonitor.measure(agentName)` returns real measurements after at least 1 LLM call — verified by integration test with mock EventBus emitting a `llm.call.completed`.

## Tasks / Subtasks

- [ ] Wire TokensPerSecMonitor in SprintRunner
  - [ ] File: `packages/app/src/composition/SprintRunner.ts`
  - [ ] In `buildRealSteps()` or `run()`: instantiate `new TokensPerSecMonitor()`
  - [ ] Subscribe to EventBus: `this.eventBus.on('llm.call.completed', (payload) => monitor.record(payload.agentType, payload.tokenCount, payload.durationMs))`
  - [ ] Import `TokensPerSecMonitor` from `@cop1/llm-intelligence`

- [ ] Integration test
  - [ ] Create EventBus + TokensPerSecMonitor
  - [ ] Emit `llm.call.completed` with `{ agentType: 'dev', tokenCount: 150, durationMs: 1000 }`
  - [ ] Verify `monitor.measure('dev')` returns `{ tokensPerSec: 150, meetsMinimum: true }`

## Dev Notes

- **No changes to TokensPerSecMonitor itself** — the class is already implemented and tested. This story is purely about wiring it into the EventBus pipeline.
- **Instantiation location**: The monitor should be created in `run()` (not `buildRealSteps()`) so it has access to `this.eventBus`. It can be stored as an instance field if needed later for ceremony eligibility checks.
- **Import**: `TokensPerSecMonitor` should already be exported from `@cop1/llm-intelligence` barrel. Verify and add to index if missing.
- **Future use**: Once wired, E8 (Ceremony Engine) can query `monitor.isEligibleForCeremony(agentName)` to enforce NFR2 (15 t/s minimum for ceremony participation).
