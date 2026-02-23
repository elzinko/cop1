# Story EA2.1: TokenBudgetService

Status: ready-for-dev

## Story

As a Developer,
I want token consumption tracked per BMAD command and per sprint,
so that I can monitor Claude API costs and know when budget limits are approaching.

## Acceptance Criteria

1. `TokenBudgetService` listens to `llm.call.completed` events and accumulates token counts per command, per agent, per sprint
2. Budget state persisted to `.cop1/budget-{date}.yaml` after each command completion — survives process restart
3. `getBudgetStatus()` returns current consumption, remaining budget, and percentage used

## Tasks / Subtasks

- [ ] Task 1: Create TokenBudgetService (AC: #1, #3)
  - [ ] Create `packages/sprint-core/src/features/budget/application/TokenBudgetService.ts`
  - [ ] Define domain types: `BudgetStatus { consumed, remaining, percentage, breakdown }`
  - [ ] Define `TokenConsumption { commandType, agentType, tokens, timestamp }`
  - [ ] Subscribe to `llm.call.completed` EventBus events
  - [ ] Extract `tokensUsed`, `model`, `agentType` from event payload
  - [ ] Accumulate in-memory: per-command breakdown, per-agent breakdown, total
  - [ ] Implement `getBudgetStatus(): BudgetStatus` reading from config limit
- [ ] Task 2: YAML persistence (AC: #2)
  - [ ] Create `BudgetStore` port interface in `domain/ports/`
  - [ ] Implement `YamlBudgetStore` adapter writing to `.cop1/budget-{YYYY-MM-DD}.yaml`
  - [ ] Save after each `llm.call.completed` event (or batch with short debounce)
  - [ ] Load on startup to restore accumulated state for current day
  - [ ] Use atomic write pattern (write .tmp, rename)
- [ ] Task 3: Budget configuration
  - [ ] Read `sprint_max_tokens` from `Cop1Config` (to be added by EA2-S2, default 1_000_000)
  - [ ] Calculate `remaining = sprint_max_tokens - consumed`
  - [ ] Calculate `percentage = consumed / sprint_max_tokens * 100`
- [ ] Task 4: Tests
  - [ ] Test: emit `llm.call.completed` with tokens -> service accumulates correctly
  - [ ] Test: multiple events -> breakdown by command type and agent type
  - [ ] Test: `getBudgetStatus()` returns correct consumed/remaining/percentage
  - [ ] Test: persistence -> save and reload -> state preserved
  - [ ] Test: new day -> fresh budget file

## Dev Notes

### Architecture Patterns

- **Feature-first hexagonal**: New feature at `packages/sprint-core/src/features/budget/`
- **EventBus subscription**: Follow pattern from other listeners. `eventBus.on('llm.call.completed', handler)`.
- **llm.call.completed payload**: Emitted by `ClaudeCliAdapter` with `{ model, agentType, promptLength, responseLength, durationMs, tokenCount }` (see `packages/sprint-core/src/features/bmad-orchestration/infrastructure/ClaudeCliAdapter.ts`).
- **YAML persistence**: Follow `YamlStatusStore` pattern for atomic YAML writes. Use `js-yaml` or similar.

### Budget File Format

```yaml
# .cop1/budget-2026-02-23.yaml
date: "2026-02-23"
total_consumed: 45000
breakdown_by_command:
  dev-story: 30000
  code-review: 10000
  qa: 5000
breakdown_by_agent:
  bmad-dev: 30000
  bmad-reviewer: 10000
  bmad-qa: 5000
events:
  - { timestamp: "...", command: "dev-story", tokens: 15000 }
  - { timestamp: "...", command: "code-review", tokens: 10000 }
```

### Project Structure Notes

- Feature dir: `packages/sprint-core/src/features/budget/`
- Domain: `domain/BudgetStatus.ts`, `domain/TokenConsumption.ts`, `domain/ports/BudgetStorePort.ts`
- Application: `application/TokenBudgetService.ts`
- Infrastructure: `infrastructure/YamlBudgetStore.ts`
- Tests: `__tests__/TokenBudgetService.test.ts`
- Export from `packages/sprint-core/src/index.ts`
- TypeScript strict, `.js` extensions, kebab-case files

### References

- [Source: packages/sprint-core/src/features/bmad-orchestration/infrastructure/ClaudeCliAdapter.ts — event emission]
- [Source: packages/shared-kernel/src/features/events/domain/EventBus.ts]
- [Source: packages/sprint-core/src/features/story-tracker/infrastructure/YamlStatusStore.ts — YAML write pattern]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-EA2 — EA2-S1]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
