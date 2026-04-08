# Test Automation Summary — EA9-S6

**Story**: EA9.6 — `ClaudeResumeSessionAdapter` (fallback `BMADSessionPort` via `claude --resume`)
**Date**: 2026-04-07
**Workflow**: bmad-bmm-qa-automate
**Framework detected**: Vitest 2.1.9 (monorepo convention `*.test.ts`, no E2E framework — pure Node infrastructure code)

## Scope assessment

EA9-S6 delivers a Node infrastructure adapter (no HTTP API surface, no UI). The
relevant test layer is unit tests with an injectable `ProcessSpawner` test
double — no API or E2E layer applies. The story's AC6 already mandated 9
explicit unit tests covering happy path, error paths, heuristics, recursion
caps, timeouts, and spawn failures. Those tests were authored during
`dev-story` and are present.

The qa-automate workflow's "happy path + 1-2 error cases" floor is therefore
already exceeded by the dev-authored suite. No additional test files were
generated; this run validates and records the existing coverage.

## Generated / existing tests

### Unit tests (Vitest)

- [x] `packages/sprint-core/src/features/bmad-orchestration/__tests__/ClaudeResumeSessionAdapter.test.ts` — 9 cases:
  1. `startSession` spawns `claude -p ... --output-format json --permission-mode acceptEdits` with correct `cwd`, parses `session_id` / `result` / `usage`.
  2. Emits `session.started` → `session.turn.completed` → `session.workflow.completed` on the EventBus.
  3. `continueSession` spawns `claude --resume <cliSessionId> -p <message>` using the mapped CLI session id.
  4. `continueSession` with unknown `sessionId` throws `Unknown sessionId ...`.
  5. `detectQuestion` heuristic table (`?` ending, `[Y/n]`, `\bcontinue\b`, statements → null).
  6. Recursion cap: looping question detection bails out at `maxAutoReplies` with the documented error message.
  7. `questionHandler` deny path returns `error: true, completed: true, errorMessage: 'escalate'` and emits `session.workflow.failed`.
  8. Timeout path: hung child process surfaces a timeout error in the returned `SessionTurnResult`.
  9. Spawn error path (`ENOENT`): returned `errorMessage` includes `spawn error` so `RetryPolicy` classifies it as permanent.

### API tests
N/A — no HTTP surface in this story.

### E2E tests
N/A — no UI surface; integration with the real `claude` CLI is intentionally
out of scope (tests must never spawn the real CLI per AC6).

## Run results

```
$ pnpm exec vitest run packages/sprint-core/src/features/bmad-orchestration/__tests__/ClaudeResumeSessionAdapter.test.ts

 ✓ packages/sprint-core/src/features/bmad-orchestration/__tests__/ClaudeResumeSessionAdapter.test.ts (9 tests) 2078ms
 Test Files  1 passed (1)
      Tests  9 passed (9)
   Duration  2.37s
```

All 9 tests pass. Suite runs in well under the 5s budget set by AC6.

## Coverage notes

- Public surface of `ClaudeResumeSessionAdapter` (`startSession`, `continueSession`, `detectQuestion`) is fully exercised.
- `detectCompletion` is implicitly covered through cases 1, 2, 6, 7 (the `stop_reason === 'end_turn'` branch and the question/no-question branches).
- The skill-folder lookup (AC2 best-effort glob) is intentionally not covered by an FS-touching test — current tests pass `command = '/test'` so the lookup misses gracefully and the adapter falls back to sending the command literally. A future story could add a tmpdir-based fixture if the lookup ever becomes load-bearing.

## Next steps

- Run the full sprint-core suite in CI alongside the rest of the EA9 changes.
- If the fallback adapter is ever promoted from env-var opt-in (`COP1_BMAD_ADAPTER=resume`) to a default, add a tmpdir-based test for the skill-folder workflow loader.
- Consider a follow-up story to extract the shared spawn helper between `ClaudeCliAdapter` and `ClaudeResumeSessionAdapter` (currently flagged with `// TODO(post-EA9)` per Dev Notes).

**Done!** No new test files needed; existing AC6 suite verified green.
