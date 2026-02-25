# Story EA1.5: SprintRunner BMAD Wiring

Status: done

## Story

As a cop1 Orchestrator,
I want SprintRunner to use BMAD-based pipeline steps by default,
so that story execution leverages BMAD's battle-tested workflows instead of naive LLM prompts.

## Acceptance Criteria

1. `SprintRunner.buildRealSteps()` returns BMAD-based pipeline (BMADDevStoryStep -> BMADReviewStep -> BMADQAStep) by default
2. Configuration flag `workflow.useBMAD: false` falls back to legacy LLM-based steps (DevAgent, ReviewerAgent, QAAgent)
3. Pipeline steps injected via DI container — no hard-coded step instantiation in SprintRunner

## Tasks / Subtasks

- [x] Task 1: Extend Cop1Config (AC: #2)
  - [x] Add `workflow: { useBMAD: boolean }` section to `Cop1Config` interface in shared-kernel
  - [x] Default `useBMAD: true`
  - [x] Update config validation/loading if needed
- [x] Task 2: Refactor SprintRunner step building (AC: #1, #3)
  - [x] Locate SprintRunner or equivalent orchestrator that calls `buildRealSteps()`
  - [x] Create step factory or builder that returns BMAD steps when `useBMAD: true`
  - [x] Inject `BMADCommandPort` (via ClaudeCliAdapter) into BMAD steps
  - [x] Inject `StoryContextBuilder` for story context preparation
  - [x] Fallback: when `useBMAD: false`, return legacy DevAgent, ReviewerAgent, QAAgent steps
- [x] Task 3: DI wiring in composition root (AC: #3)
  - [x] Update `DaemonService` or composition root to wire `ClaudeCliAdapter` as `BMADCommandPort`
  - [x] Register BMAD steps in DI container or factory
  - [x] Ensure EventBus is injected into ClaudeCliAdapter for event emission
- [x] Task 4: Tests
  - [x] Test `buildRealSteps()` returns BMAD steps when `useBMAD: true`
  - [x] Test `buildRealSteps()` returns legacy steps when `useBMAD: false`
  - [x] Integration test: full pipeline with mocked BMADCommandPort

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
claude-opus-4-6

### Debug Log References

### Completion Notes List
- Task 1: Added `workflow: { useBMAD: boolean }` to Cop1Config interface with default `true`. Updated ConfigSchema (zod) with `.default({ useBMAD: true })`. Updated 15 test fixtures across shared-kernel, sprint-core, llm-intelligence, and app packages to include the new property. 3 new tests added, 516/516 pass.
- Task 2: Created PipelineStepFactory class that encapsulates BMAD vs legacy step building. Refactored SprintRunner to use the factory via DI (constructor injection of BMADCommandPort). Removed buildRealSteps() from SprintRunner. Factory returns BMAD pipeline (BMADDevStoryStep, BMADReviewStep, BMADQAStep) when useBMAD=true, legacy pipeline (DevAgent, ReviewerAgent, QAAgent, PMAgentWorkflowStep) when false. StoryContextBuilder already injected internally by BMADCommandStep.
- Task 3: Wired ClaudeCliAdapter as BMADCommandPort in sprint-run.ts (actual composition root for sprint execution). EventBus created externally and shared between SprintRunner and ClaudeCliAdapter for consistent event emission. PipelineStepFactory registers BMAD steps internally via commandPort injection.
- Task 4: 8 new tests total: 3 ConfigLoader workflow tests, 3 PipelineStepFactory unit tests (BMAD steps, legacy steps, error on missing commandPort), 2 integration tests (full BMAD pipeline execution, story context passing). All 521 tests pass.

### File List
- packages/shared-kernel/src/features/config/domain/Cop1Config.ts (modified)
- packages/app/src/features/config/domain/ConfigSchema.ts (modified)
- packages/app/src/composition/PipelineStepFactory.ts (new)
- packages/app/src/composition/SprintRunner.ts (modified)
- packages/app/src/cli/commands/sprint-run.ts (modified)
- packages/app/src/composition/__tests__/PipelineStepFactory.test.ts (new)
- packages/app/src/features/config/__tests__/ConfigLoader.test.ts (modified)
- packages/sprint-core/src/features/dev-agent/__tests__/DevAgent.test.ts (modified)
- packages/sprint-core/src/features/qa-agent/__tests__/QAAgent.test.ts (modified)
- packages/sprint-core/src/features/reviewer-agent/__tests__/ReviewerAgent.test.ts (modified)
- packages/sprint-core/src/features/workflow/__tests__/WorkflowEngine.test.ts (modified)
- packages/sprint-core/src/features/pm-agent/__tests__/PMAgentWorkflowStep.test.ts (modified)
- packages/sprint-core/src/features/bmad-orchestration/__tests__/BMADQAStep.test.ts (modified)
- packages/sprint-core/src/features/bmad-orchestration/__tests__/BMADDevStoryStep.test.ts (modified)
- packages/sprint-core/src/features/bmad-orchestration/__tests__/BMADCommandPort.test.ts (modified)
- packages/sprint-core/src/features/bmad-orchestration/__tests__/BMADReviewStep.test.ts (modified)
- packages/llm-intelligence/src/features/llm-gateway/__tests__/LLMRouter.test.ts (modified)
- packages/llm-intelligence/src/features/llm-gateway/__tests__/LLMCodeGenerator.test.ts (modified)
- packages/llm-intelligence/src/features/llm-gateway/__tests__/LLMGateway.test.ts (modified)
- packages/llm-intelligence/src/features/llm-gateway/__tests__/LLMReviewer.test.ts (modified)
- packages/app/src/features/co-presence/__tests__/CoPresenceService.test.ts (modified)
- packages/app/src/features/resources/__tests__/SystemResourceAdapter.test.ts (modified)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)

## Senior Developer Review (AI)

**Reviewer:** elzinko | **Date:** 2026-02-25 | **Outcome:** Approved with fixes applied

**Issues Found:** 2 High, 4 Medium, 3 Low → 6 fixed, 3 Low deferred

### Fixes Applied
- **H1 (Event listener leak):** Added `tpsListenerRegistered` guard in PipelineStepFactory to prevent duplicate `llm.call.completed` listeners on repeated `build()` calls
- **H2 (DI violation):** Refactored SprintRunner to accept `stepFactory` via injected `SprintRunnerDeps` options object instead of hardcoding `new PipelineStepFactory()` internally
- **M1 (Silent degradation):** `buildLegacySteps()` now throws if `configLoader` is missing instead of silently creating gateway without routing
- **M2 (Fragile constructor):** SprintRunner constructor changed from 4 positional params to `SprintRunnerDeps` options object
- **M3 (Duplicated filter):** Replaced duplicated filter logic in sprint-run.ts dry-run block with new `SprintRunner.listEligible()` method
- **M4 (Pipeline mismatch):** Added documentation comment in PipelineStepFactory explaining why BMAD has 3 steps vs legacy 4 steps (PM handled internally by BMAD workflows)

### Deferred (Low)
- L1: `as` type assertion on event payload (acceptable risk, would need EventBus generic typing)
- L2: QAAgent.test.ts weak assertion (pre-existing, not introduced by this story)
- L3: AC #1 naming drift (`buildRealSteps` → factory pattern — intent fulfilled)

**Post-fix test results:** 522/522 pass (1 new test added for configLoader validation)

## Change Log
- 2026-02-25: Implemented SprintRunner BMAD wiring (EA1-S5). Added `workflow.useBMAD` config flag (default: true). Created PipelineStepFactory for config-driven BMAD/legacy pipeline switching. Wired ClaudeCliAdapter as BMADCommandPort in sprint-run.ts composition root. 8 new tests, 521 total pass.
- 2026-02-25: Code review fixes applied. Refactored SprintRunner to options object + DI injection of PipelineStepFactory. Fixed event listener leak, silent degradation, duplicated filter logic. Added listEligible() method. 522 total pass.
