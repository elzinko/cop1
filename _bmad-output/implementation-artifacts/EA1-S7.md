# Story EA1.7: Error Handling & Retry

Status: ready-for-dev

## Story

As a cop1 Orchestrator,
I want robust error handling and retry logic for BMAD command execution,
so that transient failures don't kill the sprint and budget exhaustion is handled gracefully.

## Acceptance Criteria

1. BMAD command timeout (configurable, default 5min) triggers graceful abort: `SIGTERM`, wait 10s, `SIGKILL` if still running
2. Retry with exponential backoff (1s, 2s, 4s, max 3 retries) on transient errors (Claude API 429/503, process crash)
3. Budget exhaustion during command -> immediate abort, story marked `blocked` with reason `budget_exhausted`, sprint continues to next story

## Tasks / Subtasks

- [ ] Task 1: Graceful timeout handling (AC: #1)
  - [ ] Add configurable timeout to `ClaudeCliAdapter` (from `Cop1Config` or BMADCommand options)
  - [ ] On timeout: send `SIGTERM` to child process, set 10s timer, `SIGKILL` if still alive
  - [ ] Emit `llm.call.failed` event with `reason: 'timeout'`
  - [ ] Return `BMADCommandResult { success: false }` with timeout error details
- [ ] Task 2: Retry with exponential backoff (AC: #2)
  - [ ] Create `RetryPolicy` utility (or add to BMADCommandStep): `{ maxRetries: 3, baseDelayMs: 1000, backoffMultiplier: 2 }`
  - [ ] Detect transient errors: HTTP 429 (rate limit), 503 (service unavailable), process exit codes indicating crash
  - [ ] Wrap `BMADCommandPort.execute()` call in retry loop with delay between attempts
  - [ ] Log each retry attempt with attempt number and delay
- [ ] Task 3: Budget exhaustion handling (AC: #3)
  - [ ] Before each BMAD command: check remaining budget via `TokenBudgetService.getBudgetStatus()` (if available, else skip)
  - [ ] If budget exhausted: skip command, return `StepResult { status: 'blocked', error: BudgetExhaustedError }`
  - [ ] If budget exhausted mid-command (detected via event): abort gracefully, mark story blocked
  - [ ] Sprint should continue to next story (not halt entirely)
- [ ] Task 4: Tests
  - [ ] Test timeout: mock long-running process, verify SIGTERM/SIGKILL sequence
  - [ ] Test retry: mock transient failures then success, verify backoff delays
  - [ ] Test budget exhaustion: mock budget check returning exhausted, verify story blocked

## Dev Notes

### Architecture Patterns

- **ClaudeCliAdapter** (`packages/sprint-core/src/features/bmad-orchestration/infrastructure/ClaudeCliAdapter.ts`): Currently spawns `claude` CLI with 600s timeout. Extend with configurable timeout and graceful kill logic.
- **BMADCommandStep** (`packages/sprint-core/src/features/bmad-orchestration/application/BMADCommandStep.ts`): The `run()` method is where retry logic should be added. Consider a decorator/wrapper pattern or inline retry.
- **child_process.spawn**: The adapter uses Node.js `child_process`. Use `process.kill(pid, 'SIGTERM')` and `setTimeout` for graceful shutdown.
- **Error classification**: Claude API errors appear in stdout/stderr of the spawned process. Parse for HTTP status codes or known error patterns.

### Important: Budget Service May Not Exist Yet

EA2-S1 (TokenBudgetService) is also a Sprint 9 story. The budget check in Task 3 should be **optional** — if `TokenBudgetService` is not yet wired, skip the pre-call check gracefully. Use a port interface so budget checking can be injected later.

### Project Structure Notes

- Retry utility: `packages/sprint-core/src/features/bmad-orchestration/domain/RetryPolicy.ts` (or simpler: inline in BMADCommandStep)
- Error types: `packages/sprint-core/src/features/bmad-orchestration/domain/errors/` (BMADTimeoutError, BMADRetryExhaustedError, BudgetExhaustedError)
- Config: Add `bmad.timeout_ms` and `bmad.max_retries` to Cop1Config
- TypeScript strict, `.js` extensions in ESM imports

### References

- [Source: packages/sprint-core/src/features/bmad-orchestration/infrastructure/ClaudeCliAdapter.ts]
- [Source: packages/sprint-core/src/features/bmad-orchestration/application/BMADCommandStep.ts]
- [Source: packages/sprint-core/src/features/bmad-orchestration/domain/ports/BMADCommandPort.ts]
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-008]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-EA1 — EA1-S7]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
