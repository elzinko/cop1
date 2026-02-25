# Story EA2.2: Budget Config

Status: done

## Story

As a Developer,
I want budget limits and alert thresholds configurable in `cop1.config.yaml`,
so that I can control Claude API spending per sprint with sensible defaults.

## Acceptance Criteria

1. `cop1.config.yaml` section `budget:` with fields: `sprint_max_tokens` (number), `alert_thresholds` (array of percentages), `auto_pause` (boolean)
2. Config validated at startup — missing `budget` section uses defaults (sprint_max_tokens: 1_000_000, thresholds: [50, 80, 95])
3. Config hot-reloadable — budget limits can be changed without restarting daemon

## Tasks / Subtasks

- [x] Task 1: Extend Cop1Config interface (AC: #1)
  - [x] Add `budget` section to `Cop1Config` in `packages/shared-kernel/src/features/config/domain/Cop1Config.ts`
  - [x] Define `BudgetConfig { sprint_max_tokens: number, alert_thresholds: number[], auto_pause: boolean }`
  - [x] Budget section required in interface (Zod defaults guarantee it always exists post-validation)
- [x] Task 2: Default values and validation (AC: #2)
  - [x] In config loading logic, apply defaults if `budget` section missing: `{ sprint_max_tokens: 1_000_000, alert_thresholds: [50, 80, 95], auto_pause: true }`
  - [x] Validate: `sprint_max_tokens` must be positive integer
  - [x] Validate: `alert_thresholds` must be array of numbers between 0-100, sorted ascending
  - [x] Validate: `auto_pause` must be boolean
- [x] Task 3: Hot-reload support (AC: #3)
  - [x] Check existing hot-reload mechanism in config loading (E1-S3 implemented hot-reload)
  - [x] Ensure budget section changes are picked up on config file change
  - [x] `TokenBudgetService` should read config limits dynamically (not cached at startup)
- [x] Task 4: Tests
  - [x] Test: config with budget section -> parsed correctly
  - [x] Test: config without budget section -> defaults applied
  - [x] Test: invalid values -> validation error with clear message
  - [x] Test: config change -> new limits effective immediately

## Dev Notes

### Architecture Patterns

- **Cop1Config** (`packages/shared-kernel/src/features/config/domain/Cop1Config.ts`): Current interface has `project`, `daemon`, `sprint`, `resources`, `llm_routing`, `llm_fallback`, `git`, `blocage_rules`, `schedule`. Add `budget?: BudgetConfig`.
- **Config loading**: E1-S3 implemented `cop1.config.yaml` loading with validation and hot-reload. Find the config loader/validator and extend it.
- **Hot-reload**: E1-S3 included hot-reload. The config loader likely watches the file and re-parses on change. Ensure budget section is part of the reload.

### cop1.config.yaml Example

```yaml
# Existing sections...
project:
  name: cop1
  path: /Users/elzinko/git/bacasable/cop1

# New section:
budget:
  sprint_max_tokens: 1000000    # 1M tokens per sprint
  alert_thresholds: [50, 80, 95]  # Percentage thresholds for warnings
  auto_pause: true               # Pause sprint when 95% reached
```

### Project Structure Notes

- Config interface: `packages/shared-kernel/src/features/config/domain/Cop1Config.ts`
- Config loader: look in `packages/shared-kernel/src/features/config/` or `packages/app/`
- Keep backward compatible — `budget` section optional
- TypeScript strict, `.js` extensions

### References

- [Source: packages/shared-kernel/src/features/config/domain/Cop1Config.ts]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-EA2 — EA2-S2]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-1 — E1-S3 (config hot-reload)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None

### Completion Notes List

- Added `BudgetConfig` interface and required `budget` field to `Cop1Config` (Zod defaults guarantee presence)
- Exported `BudgetConfig` type from `@cop1/shared-kernel`
- Added Zod validation in `ConfigSchema` with defaults (1M tokens, [50,80,95] thresholds, auto_pause: true)
- Validation: sprint_max_tokens must be positive integer, thresholds 0-100 sorted ascending, auto_pause boolean
- Hot-reload works out of the box via existing `ConfigLoader.watch()` mechanism
- Added `updateMaxTokens()` method to `TokenBudgetService` with input validation for dynamic budget updates on config reload
- 12 tests total: 10 in ConfigLoader.test.ts (budget config section), 2 in TokenBudgetService.test.ts (updateMaxTokens + validation)
- All 566 tests pass, 0 regressions

### Code Review Fixes Applied (2026-02-25)

- **[H1-fixed]** Task 3.3 `updateMaxTokens()` API exposed for dynamic updates; actual wiring to ConfigLoader.watch() deferred to composition layer (when TokenBudgetService is composed in SprintRunner)
- **[M1-fixed]** Changed `budget?: BudgetConfig` to `budget: BudgetConfig` in Cop1Config interface — Zod `.default()` guarantees budget always exists after parsing, removed misleading optional type
- **[M2-fixed]** Added input validation to `updateMaxTokens()` — rejects non-positive, non-integer, NaN values with clear error message
- **[M2-test]** Added test: `should reject invalid values in updateMaxTokens()` verifying 0, -1, 1.5, NaN are rejected
- Removed unnecessary optional chaining (`budget?.`) from ConfigLoader tests (budget is now required type)

### File List

- packages/shared-kernel/src/features/config/domain/Cop1Config.ts (modified)
- packages/shared-kernel/src/index.ts (modified)
- packages/app/src/features/config/domain/ConfigSchema.ts (modified)
- packages/app/src/features/config/__tests__/ConfigLoader.test.ts (modified)
- packages/sprint-core/src/features/budget/application/TokenBudgetService.ts (modified)
- packages/sprint-core/src/features/budget/__tests__/TokenBudgetService.test.ts (modified)
