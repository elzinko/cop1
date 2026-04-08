# Story EA9.1: BMADSessionPort + AgentSdkSessionAdapter

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **cop1 SprintRunner**,
I want a multi-turn session port and Agent SDK adapter so that BMAD workflows can be executed as interactive conversations with structured question interception,
so that cop1 can autonomously drive BMAD dev-story, code-review, and QA workflows that require multi-turn interaction.

## Acceptance Criteria

1. **AC1 — BMADSessionPort interface exists in domain/ports**
   - `BMADSessionPort` interface defined in `packages/sprint-core/src/features/bmad-orchestration/domain/ports/BMADSessionPort.ts`
   - Exposes `startSession(command: string, context: BMADSessionContext): Promise<SessionHandle>`
   - Exposes `continueSession(sessionId: string, message: string): Promise<SessionTurnResult>`
   - Supporting types: `BMADSessionContext`, `SessionHandle`, `SessionTurnResult` defined in same file
   - `SessionTurnResult.completed` is `true` when the workflow finishes (no more turns)
   - Exported via `@cop1/sprint-core` barrel `index.ts`

2. **AC2 — AgentSdkSessionAdapter implements BMADSessionPort**
   - `AgentSdkSessionAdapter` class in `packages/sprint-core/src/features/bmad-orchestration/infrastructure/AgentSdkSessionAdapter.ts`
   - `startSession()` calls `query()` from `@anthropic-ai/claude-agent-sdk` with:
     - `systemPrompt: { type: 'preset', preset: 'claude_code' }`
     - `settingSources: ['project']` (loads BMAD skills from `.claude/settings.json`)
     - `allowedTools: ['Skill', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'AskUserQuestion']` — NOTE: `allowedTools` **auto-approves** these tools (no `canUseTool` prompt), it does NOT restrict Claude to only these tools. Unlisted tools still work but trigger `canUseTool`. Including `AskUserQuestion` here would bypass interception — so `AskUserQuestion` should be handled via `canUseTool` only, NOT listed in `allowedTools`. Correct list: `['Skill', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']` (without `AskUserQuestion`).
     - `cwd` from context's `projectPath`
     - `maxTurns` configurable (default: 30)
     - `maxBudgetUsd` configurable (optional)
   - `canUseTool` callback intercepts `AskUserQuestion` tool calls and delegates to an injected `QuestionHandler` callback
   - All other tool calls are auto-approved via `{ behavior: 'allow', updatedInput: input }`
   - Returns `SessionHandle` with `sessionId` and `firstTurn` result
   - `sessionId` captured from the `Query` object via `initializationResult()` or from the first `ResultMessage` in the async iterator stream — see Dev Notes for details
   - `continueSession()` uses `resume` option to continue the same session with a new message
   - Emits events via optional `EventBus`: `session.started`, `session.turn.completed`, `session.workflow.completed`, `session.workflow.failed`
   - Exported via `@cop1/sprint-core` barrel `index.ts`

3. **AC3 — Unit tests with mock SDK**
   - Test file: `packages/sprint-core/src/features/bmad-orchestration/__tests__/AgentSdkSessionAdapter.test.ts`
   - Tests cover: successful session start, multi-turn continuation, `AskUserQuestion` interception routing, timeout handling, error propagation, event emission, **SDK crash mid-iteration**
   - SDK `query()` function is mocked (not real SDK calls) — adapter receives an injectable SDK function via constructor for testability
   - At least 7 test cases covering happy path and error scenarios (including AsyncGenerator throw mid-stream)

4. **AC4 — InMemorySessionAdapter for downstream testing**
   - `InMemorySessionAdapter` class in `packages/sprint-core/src/features/bmad-orchestration/infrastructure/InMemorySessionAdapter.ts`
   - Implements `BMADSessionPort` with pre-configured responses (scriptable)
   - Allows downstream stories (EA9-S3, EA9-S4) to test without real SDK
   - Exported via barrel `index.ts`

5. **AC5 — Package dependency added**
   - `@anthropic-ai/claude-agent-sdk` added to `packages/sprint-core/package.json` dependencies
   - `pnpm install` resolves correctly
   - `pnpm typecheck` passes with the new dependency

## Tasks / Subtasks

- [x] Task 1 — Define BMADSessionPort interface and types (AC: #1)
  - [x] Create `BMADSessionPort.ts` in `domain/ports/` with `BMADSessionContext`, `SessionHandle`, `SessionTurnResult`, `BMADSessionPort`
  - [x] Add `QuestionHandler` type: `(toolName: string, input: unknown) => Promise<{ behavior: 'allow'; updatedInput: unknown } | { behavior: 'deny'; message: string }>`
  - [x] Export all types via barrel `index.ts`
- [x] Task 2 — Implement AgentSdkSessionAdapter (AC: #2)
  - [x] Add `@anthropic-ai/claude-agent-sdk` to `packages/sprint-core/package.json`
  - [x] Run `pnpm install`
  - [x] Create `AgentSdkSessionAdapter.ts` in `infrastructure/`
  - [x] Implement `startSession()` with `query()` call, `canUseTool` interception, and event emission
  - [x] Implement `continueSession()` with session resume
  - [x] Export via barrel
- [x] Task 3 — Implement InMemorySessionAdapter (AC: #4)
  - [x] Create `InMemorySessionAdapter.ts` in `infrastructure/`
  - [x] Support scriptable turn sequences for testing
  - [x] Export via barrel
- [x] Task 4 — Write unit tests (AC: #3)
  - [x] Create `AgentSdkSessionAdapter.test.ts` in `__tests__/`
  - [x] Test: startSession happy path — SDK called with correct options
  - [x] Test: startSession with AskUserQuestion interception — `canUseTool` callback routes correctly
  - [x] Test: continueSession — resume with correct sessionId
  - [x] Test: error handling — SDK throws → adapter propagates
  - [x] Test: timeout — maxTurns exceeded
  - [x] Test: SDK crash mid-iteration — AsyncGenerator throws → adapter catches and returns error SessionTurnResult
  - [x] Test: event emission — EventBus receives correct events
- [x] Task 5 — Verify build and types (AC: #5)
  - [x] `pnpm typecheck` passes (pre-existing TS6310 errors only, no new errors)
  - [x] `pnpm test` passes (651 tests, 0 failures)
  - [x] `pnpm lint` passes (Biome check clean on new files)

## Dev Notes

### Architecture Context

This story creates the **hexagonal port** (`BMADSessionPort`) and its **primary adapter** (`AgentSdkSessionAdapter`) for multi-turn BMAD interaction, as defined in ADR-012. This complements (does NOT replace) the existing single-shot `BMADCommandPort` / `ClaudeCliAdapter` pattern.

**Key design principle:** The port is session-oriented (stateful), unlike the existing `BMADCommandPort` which is stateless single-shot. Both coexist — `BMADCommandPort` remains for simple queries, `BMADSessionPort` handles interactive workflows.

### Existing Code Patterns to Follow

**Port pattern (copy from `BMADCommandPort`):**
- Port interface in `domain/ports/` — [Source: packages/sprint-core/src/features/bmad-orchestration/domain/ports/BMADCommandPort.ts]
- Adapter in `infrastructure/` — [Source: packages/sprint-core/src/features/bmad-orchestration/infrastructure/ClaudeCliAdapter.ts]
- Constructor injection with optional `EventBus` — see `ClaudeCliAdapter` constructor pattern
- Events emitted via `EventBus.emit('domain.action', payload)` — dot-notation naming

**Adapter constructor pattern (follow `ClaudeCliAdapter`):**
```typescript
constructor(
  private readonly eventBus?: EventBus,
  private readonly options?: AgentSdkSessionAdapterOptions,
  private readonly queryFn?: QueryFunction, // Injectable for testing — defaults to SDK's query()
) {}
```

**File naming:** PascalCase for all TypeScript files. Place in existing `bmad-orchestration` feature directory.

**Import pattern:** Native ESM with `.js` extensions mandatory:
```typescript
import type { BMADSessionPort } from '../domain/ports/BMADSessionPort.js';
```

### Claude Agent SDK — Critical Implementation Details

**Package:** `@anthropic-ai/claude-agent-sdk` (npm)
**Docs:** https://platform.claude.com/docs/en/agent-sdk/typescript

**`query()` function signature:**
```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

const q = query({
  prompt: "Execute the BMAD dev-story workflow for story EA2-S3",
  options: {
    systemPrompt: { type: 'preset', preset: 'claude_code' },
    settingSources: ['project'],  // Loads CLAUDE.md + .claude/settings.json → BMAD skills available
    // Auto-approve these tools (no canUseTool prompt). Do NOT include AskUserQuestion here —
    // it must go through canUseTool to be intercepted by the QuestionHandler.
    allowedTools: ['Skill', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
    // Explicitly list tools including AskUserQuestion so Claude CAN use it (it routes via canUseTool)
    tools: ['Skill', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'AskUserQuestion'],
    cwd: '/path/to/project',
    maxTurns: 30,
    maxBudgetUsd: 5.0,
    canUseTool: async (toolName, input, options) => {
      if (toolName === 'AskUserQuestion') {
        // Structured question interception — route to QuestionHandler
        return questionHandler(toolName, input);
      }
      // Auto-approve all other tools
      return { behavior: 'allow', updatedInput: input };
    },
  },
});

// Async iterator — stream messages
for await (const message of q) {
  // Process SDKMessage
}
```

**`canUseTool` callback behavior:**
- Receives `(toolName: string, input: unknown, options: { signal: AbortSignal; suggestions?: PermissionUpdate[] })`
- Returns `{ behavior: 'allow', updatedInput: unknown }` or `{ behavior: 'deny', message: string }`
- When `toolName === 'AskUserQuestion'`, `input` contains `{ questions: [...], answers?: {...} }` — see ADR-012 §4.3
- For AskUserQuestion, return `{ behavior: 'allow', updatedInput: { questions: input.questions, answers: { [questionText]: answerLabel } } }`

**Session resume:**
```typescript
const resumed = query({
  prompt: "Continue with the corrections",
  options: {
    resume: sessionId,  // Resume existing session
    // All other options same as original
  },
});
```

**V2 interface (available but NOT recommended for V1):** There is a new V2 preview with `send()` / `stream()` patterns. Stick with the `query()` V1 interface for stability.

**SDKMessage types returned by the async iterator:**
- `AssistantMessage` — Claude's text responses
- `ResultMessage` — Final result with `subtype: 'success' | 'error'` and `result` field
- `ToolUseMessage` — Tool invocations (for logging)
- `ToolResultMessage` — Tool results

**Critical:** `settingSources: ['project']` loads BMAD skills from `.claude/settings.json`. Without this, Claude cannot discover the `/bmad-bmm-*` slash commands. Do NOT hardcode skill names — Claude discovers them autonomously via the `Skill` tool.

**Critical — `allowedTools` vs `tools` distinction:**
- `allowedTools` = tools auto-approved WITHOUT triggering `canUseTool`. Do NOT include `AskUserQuestion` here or the interception won't fire.
- `tools` = full list of tools Claude can use. If specified, Claude is restricted to ONLY these. Include `AskUserQuestion` here so Claude can ask questions (they route through `canUseTool`).
- Unlisted tools in `allowedTools` still work if in `tools` — they just trigger `canUseTool` for approval.

**Capturing `sessionId` from the first turn:**
The `Query` object returned by `query()` has an `initializationResult()` method, but it does not directly expose `sessionId`. Two approaches:
1. **Preferred:** Pass a known `sessionId` via `options.sessionId` (UUID you generate) — then you control the ID upfront.
2. **Alternative:** Use `listSessions()` after `query()` completes to find the session. Less reliable for concurrent sessions.
Recommendation: generate a UUID (`crypto.randomUUID()`) and pass it as `options.sessionId`. This way `SessionHandle.sessionId` is known before the first turn.

### QuestionHandler Type Design

The `QuestionHandler` is a callback type injected into `AgentSdkSessionAdapter`. It is NOT part of this story's logic — it just routes the intercepted question. The `SupervisorService` (EA9-S3) will provide the actual implementation.

```typescript
export type QuestionHandler = (
  toolName: string,
  input: unknown,
) => Promise<{ behavior: 'allow'; updatedInput: unknown } | { behavior: 'deny'; message: string }>;
```

For this story, provide a **default handler** that auto-answers "C" (continue) for all questions — this enables basic testing. The real supervisor replaces it in EA9-S3.

### Event Types to Emit

Follow existing event naming pattern (dot-notation):
- `session.started` — `{ sessionId, command, storyId, timestamp }`
- `session.turn.completed` — `{ sessionId, turn, durationMs, tokensUsed? }`
- `session.workflow.completed` — `{ sessionId, storyId, totalTurns, totalDurationMs }`
- `session.workflow.failed` — `{ sessionId, storyId, error, turn }`

### Testing Strategy

**Mock the SDK `query()` function** — do NOT call the real SDK in tests. Inject a `queryFn` via constructor:

```typescript
type QueryFunction = (params: { prompt: string; options?: unknown }) => AsyncGenerator<SDKMessage, void>;
```

Create test helpers that return pre-scripted `AsyncGenerator<SDKMessage>` sequences simulating:
1. A workflow completing in one turn (no questions)
2. A workflow asking a question via `AskUserQuestion` → receiving answer → completing
3. A workflow failing mid-way
4. A session resume scenario
5. **SDK crash mid-iteration** — AsyncGenerator `throw()` during `for await` loop. The adapter MUST catch this and return a `SessionTurnResult` with error info, not let the exception propagate unhandled.

**The mock `canUseTool` flow must be realistic:** When the mock query function simulates an `AskUserQuestion` tool call, the mock must actually invoke the `canUseTool` callback provided in options with a realistic `{ questions: [...] }` payload. This validates the full interception chain, not just message output. Critical for EA9-S3 downstream.

**Recommended: 30-minute spike before implementation.** Install the SDK, run a minimal `query()` call with `canUseTool`, and validate:
- Does `AskUserQuestion` trigger `canUseTool` when NOT in `allowedTools`?
- What does `initializationResult()` return? Does `sessionId` option work?
- What `SDKMessage` types are actually emitted in what order?
This prevents building mocks on incorrect assumptions about SDK behavior.

**InMemorySessionAdapter** allows tests in EA9-S3/S4/S5 to work without the SDK at all — it takes an array of `SessionTurnResult` objects and returns them sequentially.

### Project Structure Notes

All new files go in the existing `bmad-orchestration` feature within `@cop1/sprint-core`:

```
packages/sprint-core/src/features/bmad-orchestration/
├── __tests__/
│   ├── BMADCommandPort.test.ts           ← existing
│   ├── BMADDevStoryStep.test.ts          ← existing
│   ├── BMADReviewStep.test.ts            ← existing
│   ��── BMADQAStep.test.ts                ← existing
│   └── AgentSdkSessionAdapter.test.ts    ← NEW
├── application/
│   ├── BMADCommandStep.ts                ← existing (untouched)
│   ├── BMADDevStoryStep.ts               ← existing (untouched)
│   ├���─ BMADReviewStep.ts                 ← existing (untouched)
│   └── BMADQAStep.ts                     ← existing (untouched)
├── domain/
│   ├── ports/
│   │   ├── BMADCommandPort.ts            ← existing (untouched)
│   │   └── BMADSessionPort.ts            ← NEW
│   ├── StoryContextBuilder.ts            ← existing
│   └── RetryPolicy.ts                    ← existing
└── infrastructure/
    ├── ClaudeCliAdapter.ts               ← existing (untouched)
    ├── AgentSdkSessionAdapter.ts         ← NEW
    └── InMemorySessionAdapter.ts         ← NEW
```

**No changes to existing files** except `index.ts` barrel (add exports).

### References

- [Source: _bmad-output/planning-artifacts/adr-012-multi-turn-bmad-interaction.md — Sections 1-7, 11-12]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic EA9 — Story EA9-S1 definition]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-06.md — Section 2: Impact Analysis]
- [Source: packages/sprint-core/src/features/bmad-orchestration/domain/ports/BMADCommandPort.ts — Existing port pattern]
- [Source: packages/sprint-core/src/features/bmad-orchestration/infrastructure/ClaudeCliAdapter.ts — Existing adapter pattern]
- [Source: packages/sprint-core/src/features/bmad-orchestration/application/BMADCommandStep.ts — Existing step pattern with retry/budget]
- [Source: packages/sprint-core/src/features/workflow/domain/WorkflowStep.ts — WorkflowStep interface]
- [Source: packages/sprint-core/src/features/workflow/domain/WorkflowContext.ts — WorkflowContext type]
- [Source: packages/sprint-core/src/features/workflow/domain/StepResult.ts — StepResult type]
- [Source: packages/app/src/composition/PipelineStepFactory.ts — Composition root, future wiring point (EA9-S5)]
- [Docs: https://platform.claude.com/docs/en/agent-sdk/typescript — Agent SDK TypeScript reference]
- [Docs: https://platform.claude.com/docs/en/agent-sdk/user-input — AskUserQuestion handling]
- [Source: _bmad-output/project-context.md — All implementation rules]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

N/A

### Completion Notes List

- Created `BMADSessionPort` interface and supporting types (`BMADSessionContext`, `SessionHandle`, `SessionTurnResult`, `QuestionHandler`) in hexagonal domain/ports layer
- Implemented `AgentSdkSessionAdapter` using Claude Agent SDK `query()` function with:
  - `canUseTool` callback intercepting `AskUserQuestion` → delegates to injected `QuestionHandler`
  - All other tools auto-approved
  - Lazy dynamic import of SDK for testability (no top-level import)
  - Session resume via `resume: sessionId` option
  - EventBus event emission: `session.started`, `session.turn.completed`, `session.workflow.completed`, `session.workflow.failed`
  - Default `QuestionHandler` auto-answers with original input (continue behavior)
- Implemented `InMemorySessionAdapter` with scriptable turn sequences for downstream testing (EA9-S3, EA9-S4)
- 10 unit tests covering: happy path, SDK options validation, AskUserQuestion interception, non-AskUserQuestion auto-approve, session resume, SDK error handling, maxTurns error, mid-stream crash, event emission, default handler
- SDK version installed: `@anthropic-ai/claude-agent-sdk@0.1.77`
- All 651 project tests pass with 0 regressions
- Biome lint clean on all new files

### File List

- packages/sprint-core/src/features/bmad-orchestration/domain/ports/BMADSessionPort.ts (NEW)
- packages/sprint-core/src/features/bmad-orchestration/infrastructure/AgentSdkSessionAdapter.ts (NEW)
- packages/sprint-core/src/features/bmad-orchestration/infrastructure/InMemorySessionAdapter.ts (NEW)
- packages/sprint-core/src/features/bmad-orchestration/__tests__/AgentSdkSessionAdapter.test.ts (NEW)
- packages/sprint-core/src/index.ts (MODIFIED — added barrel exports)
- packages/sprint-core/package.json (MODIFIED — added @anthropic-ai/claude-agent-sdk dependency)

### Change Log

- 2026-04-06: Implemented EA9-S1 — BMADSessionPort + AgentSdkSessionAdapter for multi-turn BMAD interaction (ADR-012)
- 2026-04-06: Code review — 6 issues fixed (1 CRITICAL, 2 HIGH, 3 MEDIUM), 3 LOW deferred

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.6 | **Date:** 2026-04-06 | **Outcome:** Approved with fixes applied

### Findings Fixed (6)

1. **[CRITICAL] F1 — Session resume broken**: `continueSession()` passed a locally generated UUID as `resume` option, but SDK expects its own internal `session_id`. Fixed: adapter now captures `session_id` from the SDK message stream and stores it in a `Map<adapterSessionId, sdkSessionId>` for correct resume.

2. **[HIGH] F2 — Default QuestionHandler missing "C" answers**: Default handler passed through input unchanged instead of adding `answers: { [q]: 'C' }`. Fixed: handler now iterates `questions` array and populates `answers` map with "C" per AskUserQuestion protocol.

3. **[HIGH] F3 — `tools` option used preset instead of explicit list**: Implementation used `tools: { type: 'preset', preset: 'claude_code' }` giving access to all tools. Fixed: changed to explicit `tools: ['Skill', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'AskUserQuestion']` per AC2.

4. **[MEDIUM] F4 — `continueSession` lost session context**: `cwd` and `storyId` were undefined on resume. Fixed: adapter stores `BMADSessionContext` per session in a `Map` and retrieves it in `continueSession`.

5. **[MEDIUM] F5 — `session.turn.completed` fired once, not per turn**: Event was emitted after the loop, not per assistant message. Fixed: event now emits inside the loop after each assistant message turn.

6. **[MEDIUM] F6 — Unused `Query` import**: Removed unused import flagged by Biome.

### Findings Deferred (3 LOW)

7. **[LOW] F7 — Success result overwrites accumulated output**: `output = message.result || output` discards assistant text when result has content. Acceptable for now — result message is the canonical final output.

8. **[LOW] F8 — InMemorySessionAdapter ignores sessionId**: Continues returning scripted turns regardless of session. Acceptable for current simple test scenarios.

9. **[LOW] F9 — No abort/cancellation support**: SDK supports `abortController` but adapter doesn't expose it. Can be added in a future story if needed.

### Test Updates

- 12 tests (was 10): added "should continue a session with resume option using SDK session_id" and "should preserve context (cwd, storyId) across continueSession calls"
- Updated default handler test to verify `answers` map with "C" values
- Updated SDK options test to verify explicit `tools` array
- All 655 project tests pass, Biome lint clean
