# Story EA2.2: Budget Config

Status: ready-for-dev

## Story

As a Developer,
I want budget limits and alert thresholds configurable in `cop1.config.yaml`,
so that I can control Claude API spending per sprint with sensible defaults.

## Acceptance Criteria

1. `cop1.config.yaml` section `budget:` with fields: `sprint_max_tokens` (number), `alert_thresholds` (array of percentages), `auto_pause` (boolean)
2. Config validated at startup — missing `budget` section uses defaults (sprint_max_tokens: 1_000_000, thresholds: [50, 80, 95])
3. Config hot-reloadable — budget limits can be changed without restarting daemon

## Tasks / Subtasks

- [ ] Task 1: Extend Cop1Config interface (AC: #1)
  - [ ] Add `budget` section to `Cop1Config` in `packages/shared-kernel/src/features/config/domain/Cop1Config.ts`
  - [ ] Define `BudgetConfig { sprint_max_tokens: number, alert_thresholds: number[], auto_pause: boolean }`
  - [ ] Budget section is optional in the interface (backward compatible)
- [ ] Task 2: Default values and validation (AC: #2)
  - [ ] In config loading logic, apply defaults if `budget` section missing: `{ sprint_max_tokens: 1_000_000, alert_thresholds: [50, 80, 95], auto_pause: true }`
  - [ ] Validate: `sprint_max_tokens` must be positive integer
  - [ ] Validate: `alert_thresholds` must be array of numbers between 0-100, sorted ascending
  - [ ] Validate: `auto_pause` must be boolean
- [ ] Task 3: Hot-reload support (AC: #3)
  - [ ] Check existing hot-reload mechanism in config loading (E1-S3 implemented hot-reload)
  - [ ] Ensure budget section changes are picked up on config file change
  - [ ] `TokenBudgetService` should read config limits dynamically (not cached at startup)
- [ ] Task 4: Tests
  - [ ] Test: config with budget section -> parsed correctly
  - [ ] Test: config without budget section -> defaults applied
  - [ ] Test: invalid values -> validation error with clear message
  - [ ] Test: config change -> new limits effective immediately

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

### Debug Log References

### Completion Notes List

### File List
