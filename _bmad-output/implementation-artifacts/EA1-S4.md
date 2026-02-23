# Story EA1.4: BMADQAStep

Status: ready-for-dev

## Story

As a cop1 Orchestrator,
I want a BMADQAStep that wraps QA validation via BMAD command,
so that story code is validated through BMAD's thorough QA workflow instead of the basic QAAgent.

## Acceptance Criteria

1. `BMADQAStep` implements `WorkflowStep`, executes QA validation via BMAD command (tests pass, AC coverage verified)
2. QA output parsed for pass/fail — failure feeds back to dev step with QA feedback context
3. Unit tests with mocked `BMADCommandPort` verify step execution, context injection, and output parsing

## Tasks / Subtasks

- [ ] Task 1: Create BMADQAStep class (AC: #1)
  - [ ] Create `packages/sprint-core/src/features/bmad-orchestration/application/BMADQAStep.ts`
  - [ ] Extend `BMADCommandStep` abstract class (like BMADDevStoryStep and BMADReviewStep)
  - [ ] Set `name = 'bmad-qa'`, define appropriate `command` and `errorPrefix`
  - [ ] Inject story context via `StoryContextBuilder`
- [ ] Task 2: Output parsing (AC: #2)
  - [ ] Parse BMAD QA command output for pass/fail indicators
  - [ ] On failure: return `StepResult { status: 'failed', report: qaFeedback }` with actionable feedback
  - [ ] On success: return `StepResult { status: 'ok', report: qaSummary }`
- [ ] Task 3: Tests (AC: #3)
  - [ ] Create `__tests__/BMADQAStep.test.ts` following pattern from `BMADDevStoryStep.test.ts`
  - [ ] Mock `BMADCommandPort.execute()` for success and failure scenarios
  - [ ] Verify context injection includes story content and project path
  - [ ] Verify output parsing extracts pass/fail correctly

## Dev Notes

### Architecture Patterns

- **Follow existing BMADCommandStep pattern exactly**. See `BMADDevStoryStep.ts` and `BMADReviewStep.ts` for reference — they extend `BMADCommandStep` which handles the `BMADCommandPort.execute()` call, event emission, and error handling.
- **BMADCommandStep** (`packages/sprint-core/src/features/bmad-orchestration/application/BMADCommandStep.ts`): Abstract class implementing `WorkflowStep`. Subclasses define `name`, `command`, and `errorPrefix`. The `run()` method calls `port.execute(command, context)`.
- **BMADCommandPort interface**: `execute(command: string, context: Record<string, string>): Promise<BMADCommandResult>` where result has `{ success, output, tokensUsed?, durationMs }`.
- **QA command**: The BMAD QA workflow doesn't have a standard `/bmad-bmm-qa` command yet. Check available BMAD workflows or use a generic QA validation approach (run tests, check coverage, validate ACs).

### Key Implementation Detail

The existing `QAAgent` (`packages/sprint-core/src/features/qa-agent/application/QAAgent.ts`) runs `pnpm test` and `pnpm biome check .` directly. The BMADQAStep should delegate to BMAD which runs a more comprehensive QA workflow. If no dedicated BMAD QA command exists, consider wrapping the test execution + AC validation in a BMAD prompt.

### Project Structure Notes

- File: `packages/sprint-core/src/features/bmad-orchestration/application/BMADQAStep.ts`
- Test: `packages/sprint-core/src/features/bmad-orchestration/__tests__/BMADQAStep.test.ts`
- Export from `packages/sprint-core/src/features/bmad-orchestration/index.ts`
- Follow kebab-case filenames, PascalCase classes
- TypeScript strict mode, NodeNext module resolution, `.js` extensions in imports

### References

- [Source: packages/sprint-core/src/features/bmad-orchestration/application/BMADCommandStep.ts]
- [Source: packages/sprint-core/src/features/bmad-orchestration/application/BMADDevStoryStep.ts]
- [Source: packages/sprint-core/src/features/bmad-orchestration/application/BMADReviewStep.ts]
- [Source: packages/sprint-core/src/features/bmad-orchestration/__tests__/BMADDevStoryStep.test.ts]
- [Source: packages/sprint-core/src/features/qa-agent/application/QAAgent.ts]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-EA1 — EA1-S4]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
