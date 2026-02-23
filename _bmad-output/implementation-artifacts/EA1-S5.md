# Story EA1.5: SprintRunner BMAD Wiring

Status: ready-for-dev

## Story

As a cop1 Orchestrator,
I want SprintRunner to use BMAD-based pipeline steps by default,
so that story execution leverages BMAD's battle-tested workflows instead of naive LLM prompts.

## Acceptance Criteria

1. `SprintRunner.buildRealSteps()` returns BMAD-based pipeline (BMADDevStoryStep -> BMADReviewStep -> BMADQAStep) by default
2. Configuration flag `workflow.useBMAD: false` falls back to legacy LLM-based steps (DevAgent, ReviewerAgent, QAAgent)
3. Pipeline steps injected via DI container — no hard-coded step instantiation in SprintRunner

## Tasks / Subtasks

- [ ] Task 1: Extend Cop1Config (AC: #2)
  - [ ] Add `workflow: { useBMAD: boolean }` section to `Cop1Config` interface in shared-kernel
  - [ ] Default `useBMAD: true`
  - [ ] Update config validation/loading if needed
- [ ] Task 2: Refactor SprintRunner step building (AC: #1, #3)
  - [ ] Locate SprintRunner or equivalent orchestrator that calls `buildRealSteps()`
  - [ ] Create step factory or builder that returns BMAD steps when `useBMAD: true`
  - [ ] Inject `BMADCommandPort` (via ClaudeCliAdapter) into BMAD steps
  - [ ] Inject `StoryContextBuilder` for story context preparation
  - [ ] Fallback: when `useBMAD: false`, return legacy DevAgent, ReviewerAgent, QAAgent steps
- [ ] Task 3: DI wiring in composition root (AC: #3)
  - [ ] Update `DaemonService` or composition root to wire `ClaudeCliAdapter` as `BMADCommandPort`
  - [ ] Register BMAD steps in DI container or factory
  - [ ] Ensure EventBus is injected into ClaudeCliAdapter for event emission
- [ ] Task 4: Tests
  - [ ] Test `buildRealSteps()` returns BMAD steps when `useBMAD: true`
  - [ ] Test `buildRealSteps()` returns legacy steps when `useBMAD: false`
  - [ ] Integration test: full pipeline with mocked BMADCommandPort

## Dev Notes

### Architecture Patterns

- **SprintRunner**: Look for the component that builds the step array passed to `WorkflowEngine.run(context, steps)`. This is where the BMAD/legacy switch happens.
- **WorkflowEngine** (`packages/sprint-core/src/features/workflow/application/WorkflowEngine.ts`): Takes `steps: WorkflowStep[]` — it doesn't care if they're BMAD or legacy.
- **Composition root** (`packages/app/src/features/daemon/application/DaemonService.ts`): Currently initializes HttpServer, PidFileManager. This is where `ClaudeCliAdapter` should be instantiated and injected.
- **ClaudeCliAdapter** (`packages/sprint-core/src/features/bmad-orchestration/infrastructure/ClaudeCliAdapter.ts`): Implements `BMADCommandPort`. Needs `EventBus` injection for `llm.call.started/completed` events. Timeout default: 600,000ms.

### Critical: YamlStatusStore Path

The current `YamlStatusStore` reads from `.cop1/sprint-status.yaml`. The Sprint 9 refactoring (Proposal 5) will change this to `_bmad-output/implementation-artifacts/sprint-status.yaml`. This story should NOT depend on that refactoring — use the current path for now. The refactoring can be done as a separate task.

### Project Structure Notes

- Config interface: `packages/shared-kernel/src/features/config/domain/Cop1Config.ts`
- SprintRunner or pipeline builder: search in `packages/sprint-core/src/features/` or `packages/app/src/features/`
- DaemonService: `packages/app/src/features/daemon/application/DaemonService.ts`
- Follow DI pattern: constructor injection, no `new` in business logic

### References

- [Source: packages/sprint-core/src/features/workflow/application/WorkflowEngine.ts]
- [Source: packages/sprint-core/src/features/bmad-orchestration/infrastructure/ClaudeCliAdapter.ts]
- [Source: packages/sprint-core/src/features/bmad-orchestration/application/BMADCommandStep.ts]
- [Source: packages/app/src/features/daemon/application/DaemonService.ts]
- [Source: packages/shared-kernel/src/features/config/domain/Cop1Config.ts]
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-008]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-EA1 — EA1-S5]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
