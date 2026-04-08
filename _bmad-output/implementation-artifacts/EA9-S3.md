# Story EA9.3: SupervisorService + Session Logging & History

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **cop1 SprintRunner**,
I want a SupervisorService that orchestrates intelligent responses to BMAD workflow questions at three levels (deterministic, LLM, escalation) and logs all session interactions in a queryable format,
so that BMAD workflows run autonomously with traced decision history, and the supervisor itself can learn from past sessions.

## Acceptance Criteria

1. **AC1 — SupervisorService orchestrates three response levels**
   - `SupervisorService` class in `packages/sprint-core/src/features/bmad-orchestration/application/SupervisorService.ts`
   - `respond(question: SupervisorQuestion, context: SupervisorContext): Promise<SupervisorResponse>`
   - **Level 1 — Deterministic:** Matches simple patterns (continuation prompts like "Continue?", "Ready?", "[C]", story selection like "Which story?") via a configurable lookup table. Returns instantly without LLM call.
   - **Level 2 — LLM Supervisor:** If no deterministic match, delegates to `SupervisorLLMPort.generateResponse()` with full context.
   - **Level 3 — Escalation:** If the LLM response starts with `ESCALATE:`, returns `{ escalated: true, escalationReason }`. If LLM fails (error/timeout), also escalates with error reason.
   - Constructor injection: `SupervisorLLMPort`, `SessionLogger`, optional `EventBus`
   - Exported via `@cop1/sprint-core` barrel `index.ts`

2. **AC2 — Deterministic lookup table is configurable**
   - Default patterns cover: continuation prompts (`/continue|ready|proceed|\[c\]/i` → "C"), story selection (`/which story|story.*select/i` → from `context.storyId`), YOLO prompts (`/yolo|\[y\]/i` → "y")
   - Patterns are `Array<{ pattern: RegExp; answer: string | ((ctx: SupervisorContext) => string) }>` — injectable via constructor for extensibility
   - At least 5 default patterns covering the most common BMAD workflow questions

3. **AC3 — SessionLogger writes enriched interaction logs**
   - `SessionLogger` class in `packages/sprint-core/src/features/bmad-orchestration/application/SessionLogger.ts`
   - Writes to `.cop1/sprint-log-*.jsonl` via the existing `StructuredLogger` (from `@cop1/observability`)
   - Each log entry includes: `sessionId`, `storyId`, `epicId` (derived from storyId), `workflowCommand`, `turn` number, `role` ("workflow" | "supervisor" | "system"), `content` (question or answer text), `analysis` (`{ type, method }`), `durationMs`, `tokensUsed?`, `timestamp`
   - Event types emitted: `session.turn.question_intercepted`, `session.turn.answered_deterministic`, `session.turn.answered_llm`, `session.turn.escalated`
   - Exported via barrel `index.ts`

4. **AC4 — SessionHistoryReader queries past interactions**
   - `SessionHistoryReader` class in `packages/sprint-core/src/features/bmad-orchestration/application/SessionHistoryReader.ts`
   - Reads `.cop1/sprint-log-*.jsonl` files and filters by: `storyId`, `epicId` (prefix match, e.g. "EA9"), `sessionId`, date range
   - Returns `SessionInteraction[]` sorted chronologically
   - `getHistoryForStory(storyId: string): Promise<SessionInteraction[]>` — all interactions for a given story
   - `getHistoryForEpic(epicPrefix: string): Promise<SessionInteraction[]>` — all interactions for stories in an epic
   - `getRecentHistory(limit?: number): Promise<SessionInteraction[]>` — last N interactions across all stories
   - Used by SupervisorService to populate `context.sessionHistory` with cross-story intelligence
   - Exported via barrel `index.ts`

5. **AC5 — SupervisorService acts as QuestionHandler for AgentSdkSessionAdapter**
   - `SupervisorService.createQuestionHandler(): QuestionHandler` returns a callback compatible with `AgentSdkSessionAdapter`'s `QuestionHandler` type
   - The handler extracts the question from `AskUserQuestion` input, calls `respond()`, logs the interaction, and returns the formatted SDK response (`{ behavior: 'allow', updatedInput: { questions, answers } }`)
   - If escalated, returns `{ behavior: 'deny', message: 'ESCALATE: [reason]' }`

6. **AC6 — Unit tests**
   - Test files in `packages/sprint-core/src/features/bmad-orchestration/__tests__/`
   - `SupervisorService.test.ts`: deterministic matching (5+ patterns), LLM fallback, escalation handling, LLM error → escalation, session history integration
   - `SessionLogger.test.ts`: log entry format validation, event emission, epicId derivation from storyId
   - `SessionHistoryReader.test.ts`: JSONL parsing, filtering by storyId/epicId/dateRange, chronological sorting, empty results
   - At least 15 test cases total across all files
   - Uses `InMemorySupervisorAdapter` (from EA9-S2) for LLM mock — no real SDK calls

## Tasks / Subtasks

- [x] Task 1 — Create SessionLogger (AC: #3)
  - [x] Create `SessionLogger.ts` in `application/`
  - [x] Define `SessionInteraction` type with all required fields
  - [x] Inject `StructuredLogger` via constructor (from `@cop1/observability`)
  - [x] Implement `logInteraction(entry: SessionInteraction): void`
  - [x] Derive `epicId` from `storyId` (e.g., "EA9-S3" → "EA9")
  - [x] Emit events via optional `EventBus`
  - [x] Export via barrel
  - [x] Write tests: log format, epicId derivation, event emission
- [x] Task 2 — Create SessionHistoryReader (AC: #4)
  - [x] Create `SessionHistoryReader.ts` in `application/`
  - [x] Read and parse `.cop1/sprint-log-*.jsonl` files
  - [x] Filter by `storyId`, `epicId` (prefix), `sessionId`, date range
  - [x] Implement `getHistoryForStory()`, `getHistoryForEpic()`, `getRecentHistory()`
  - [x] Export via barrel
  - [x] Write tests: JSONL parsing, filtering, sorting, empty results
- [x] Task 3 — Create SupervisorService (AC: #1, #2, #5)
  - [x] Create `SupervisorService.ts` in `application/`
  - [x] Implement deterministic lookup with default patterns
  - [x] Implement LLM fallback via `SupervisorLLMPort`
  - [x] Implement escalation detection (`ESCALATE:` prefix, LLM error)
  - [x] Inject `SessionLogger` and log each interaction
  - [x] Implement `createQuestionHandler()` returning `QuestionHandler` compatible callback
  - [x] Use `SessionHistoryReader` to populate `sessionHistory` in context
  - [x] Export via barrel
  - [x] Write tests: deterministic matching, LLM fallback, escalation, error handling, QuestionHandler integration

- [x] Task 4 — Update barrel exports and verify (AC: all)
  - [x] Update `packages/sprint-core/src/index.ts` with new exports
  - [x] `pnpm typecheck` passes (pre-existing TS6310/budget errors only)
  - [x] `pnpm test` passes (680/681 pass, 1 pre-existing failure)
  - [x] `pnpm lint` passes

## Dev Notes

### Architecture Context

The `SupervisorService` is the **brain** of the multi-turn BMAD interaction system (ADR-012). It sits between the `AgentSdkSessionAdapter` (EA9-S1) and the `SupervisorLLMPort` (EA9-S2), orchestrating how questions from BMAD workflows are answered.

```
AgentSdkSessionAdapter (EA9-S1)
  └── canUseTool intercepts AskUserQuestion
        └── QuestionHandler callback
              └── SupervisorService.respond()        ← THIS STORY
                    ├── Level 1: Deterministic lookup (instant)
                    ├── Level 2: SupervisorLLMPort (EA9-S2)
                    └── Level 3: Escalation (return ESCALATE)
                    └── SessionLogger → StructuredLogger → .cop1/sprint-log-*.jsonl
```

Additionally, this story adds **session logging and history** — the observability layer that traces all supervisor decisions and enables cross-story learning.

### Dependencies Consumed (both done)

**From EA9-S1:**
- `BMADSessionPort`, `QuestionHandler` type — [Source: packages/sprint-core/src/features/bmad-orchestration/domain/ports/BMADSessionPort.ts]
- `AgentSdkSessionAdapter` with injectable `questionHandler` option — [Source: packages/sprint-core/src/features/bmad-orchestration/infrastructure/AgentSdkSessionAdapter.ts]

**From EA9-S2:**
- `SupervisorLLMPort`, `SupervisorQuestion`, `SupervisorResponse`, `SupervisorContext` — [Source: packages/sprint-core/src/features/bmad-orchestration/domain/ports/SupervisorLLMPort.ts]
- `InMemorySupervisorAdapter` — [Source: packages/sprint-core/src/features/bmad-orchestration/infrastructure/InMemorySupervisorAdapter.ts]
- `buildSupervisorPrompt()` — [Source: packages/sprint-core/src/features/bmad-orchestration/domain/SupervisorPromptBuilder.ts]

**From @cop1/observability:**
- `StructuredLogger` — [Source: packages/observability/src/features/logger/application/StructuredLogger.ts]
- `LoggerBridge` (already bridges EventBus → JSONL) — [Source: packages/observability/src/features/logger/application/LoggerBridge.ts]

### Deterministic Answer Patterns (ADR-012 §4.3)

```typescript
interface DeterministicPattern {
  pattern: RegExp;
  answer: string | ((ctx: SupervisorContext) => string);
}

const DEFAULT_PATTERNS: DeterministicPattern[] = [
  // Continuation prompts
  { pattern: /continue|ready to proceed|ready to start|\[c\]|proceed/i, answer: 'C' },
  // YOLO / auto-mode
  { pattern: /yolo|\[y\]|auto.?mode/i, answer: 'y' },
  // Story selection
  { pattern: /which story|story.*select|select.*story/i, answer: (ctx) => ctx.storyId },
  // Confirmation
  { pattern: /confirm|approve|looks good|\[a\]/i, answer: 'c' },
  // Party mode / advanced elicitation skip
  { pattern: /advanced elicitation|party.?mode/i, answer: 'c' },
];
```

The patterns are matched against `question.currentQuestion` (case-insensitive). First match wins. If no match → Level 2 (LLM).

### SessionInteraction Type

```typescript
export interface SessionInteraction {
  timestamp: string;           // ISO 8601
  sessionId: string;
  storyId: string;
  epicId: string;              // Derived: "EA9-S3" → "EA9"
  workflowCommand: string;
  turn: number;
  role: 'workflow' | 'supervisor' | 'system';
  content: string;             // Question text or answer text
  analysis: {
    type: 'question_simple' | 'question_complex' | 'completion' | 'error' | 'escalation';
    method: 'deterministic' | 'llm' | 'escalation';
  };
  durationMs: number;
  tokensUsed?: number;
}
```

**epicId derivation:** Extract everything before the last `-S` in the storyId. Examples:
- `"EA9-S3"` → `"EA9"`
- `"E12-S6b"` → `"E12"`
- `"EA2-S0c"` → `"EA2"`

### SessionHistoryReader — JSONL Parsing

The reader scans `.cop1/sprint-log-*.jsonl` files. Each line is a JSON object. Filter for entries where `eventType` starts with `session.turn.` and has the expected fields.

```typescript
// Reading pattern — matches StructuredLogger's output
const files = glob.sync('.cop1/sprint-log-*.jsonl', { cwd: projectPath });
for (const file of files) {
  const lines = readFileSync(file, 'utf-8').split('\n').filter(Boolean);
  for (const line of lines) {
    const entry = JSON.parse(line) as LogEntry;
    if (entry.eventType?.startsWith('session.turn.') && entry.storyId) {
      // Include in results
    }
  }
}
```

**Important:** Use `node:fs` `readFileSync` + `readdirSync` with glob pattern, NOT the `Glob` tool. This is runtime code, not a CLI tool.

### QuestionHandler Integration

The `createQuestionHandler()` method bridges the `SupervisorService` with the `AgentSdkSessionAdapter`:

```typescript
createQuestionHandler(): QuestionHandler {
  return async (toolName: string, input: unknown) => {
    if (toolName !== 'AskUserQuestion') {
      return { behavior: 'allow', updatedInput: input };
    }

    const payload = input as { questions?: Array<{ question: string }> };
    const questionText = payload.questions?.[0]?.question ?? String(input);

    const question: SupervisorQuestion = {
      currentQuestion: questionText,
      workflowCommand: this.currentWorkflowCommand,
      storyId: this.currentStoryId,
    };

    const response = await this.respond(question, this.currentContext);

    if (response.escalated) {
      return { behavior: 'deny', message: `ESCALATE: ${response.escalationReason}` };
    }

    // Format answer per AskUserQuestion protocol
    const answers: Record<string, string> = {};
    if (payload.questions) {
      for (const q of payload.questions) {
        answers[q.question] = response.answer;
      }
    }

    return {
      behavior: 'allow',
      updatedInput: { ...payload, answers },
    };
  };
}
```

### Testing Strategy

- Use `InMemorySupervisorAdapter` (EA9-S2) to mock the LLM port — no real SDK calls
- Use temp directories with hand-crafted JSONL files for `SessionHistoryReader` tests
- For `SessionLogger` tests, inject a mock `StructuredLogger` or use temp `.cop1/` dir
- For `SupervisorService` tests, inject both `InMemorySupervisorAdapter` and a mock `SessionLogger`
- Follow existing test patterns: `beforeEach`/`afterEach` with temp dirs, random suffixes, cleanup

### Project Structure

```
packages/sprint-core/src/features/bmad-orchestration/
├── __tests__/
│   ├── (existing tests...)
│   ├── SupervisorService.test.ts         ← NEW
│   ├── SessionLogger.test.ts             ← NEW
│   └── SessionHistoryReader.test.ts      ← NEW
├── application/
│   ├── (existing files...)
│   ├── SupervisorService.ts              ← NEW
│   ├── SessionLogger.ts                  ← NEW
│   └── SessionHistoryReader.ts           ← NEW
├── domain/
│   ├── ports/
│   │   ├── BMADCommandPort.ts            ← unchanged
│   │   ├── BMADSessionPort.ts            ← unchanged
│   │   └── SupervisorLLMPort.ts          ← unchanged
│   └── SupervisorPromptBuilder.ts        ← unchanged
└── infrastructure/
    ├── (existing files unchanged)
```

**No changes to existing files** except `index.ts` barrel (add exports).

### LoggerBridge Integration Note

The existing `LoggerBridge` in `@cop1/observability` listens for specific event types. The new `session.turn.*` events emitted by `SessionLogger` will automatically be persisted if `LoggerBridge.TRACKED_EVENTS` is updated. However, **do NOT modify `LoggerBridge`** in this story — the `SessionLogger` writes directly via `StructuredLogger`, bypassing the EventBus→LoggerBridge path. The EventBus events (`session.turn.question_intercepted`, etc.) are for real-time observability (SSE to web clients), while `StructuredLogger` is for durable persistence. Both channels coexist.

### References

- [Source: _bmad-output/planning-artifacts/adr-012-multi-turn-bmad-interaction.md — Sections 4.3 (deterministic answers), 4.4 (supervisor), 7 (session logging)]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic EA9 — Story EA9-S3 definition]
- [Source: _bmad-output/implementation-artifacts/EA9-S1.md — Done: BMADSessionPort, AgentSdkSessionAdapter, QuestionHandler type]
- [Source: _bmad-output/implementation-artifacts/EA9-S2.md — Done: SupervisorLLMPort, AgentSdkSupervisorAdapter, InMemorySupervisorAdapter, SupervisorPromptBuilder]
- [Source: packages/sprint-core/src/features/bmad-orchestration/domain/ports/BMADSessionPort.ts — QuestionHandler type]
- [Source: packages/sprint-core/src/features/bmad-orchestration/domain/ports/SupervisorLLMPort.ts — SupervisorQuestion, SupervisorResponse, SupervisorContext]
- [Source: packages/sprint-core/src/features/bmad-orchestration/infrastructure/AgentSdkSessionAdapter.ts — canUseTool callback, questionHandler injection]
- [Source: packages/observability/src/features/logger/application/StructuredLogger.ts — LogEntry, StructuredLogger]
- [Source: packages/observability/src/features/logger/application/LoggerBridge.ts — EventBus→JSONL bridge pattern]
- [Source: _bmad-output/project-context.md — All implementation rules]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation, no debugging needed.

### Completion Notes List

- **Task 1:** Created `SessionLogger` with `SessionInteraction` type, `deriveEpicId()` helper, `logInteraction()` method that writes to `StructuredLogger` and optionally emits events via `EventBus`. 11 unit tests covering log format, epicId derivation (EA9-S3→EA9, E12-S6b→E12, EA2-S0c→EA2), event emission, and all 4 event types.
- **Task 2:** Created `SessionHistoryReader` that reads `.cop1/sprint-log-*.jsonl` files, parses entries, filters by storyId/epicId/sessionId/dateRange, sorts chronologically. 11 unit tests covering JSONL parsing, filtering, sorting, empty results, multi-file reading, malformed JSON handling, and `getRecentHistory()` limit.
- **Task 3:** Created `SupervisorService` with 3-level response strategy: Level 1 deterministic (5 default patterns), Level 2 LLM fallback via `SupervisorLLMPort`, Level 3 escalation (ESCALATE: prefix or LLM error). Added `createQuestionHandler()` for `AgentSdkSessionAdapter` integration. Uses `SessionHistoryReader` to enrich context with cross-story history. 16 unit tests covering all levels, custom patterns, QuestionHandler integration.
- **Task 4:** Updated `@cop1/sprint-core` barrel with 6 new exports (3 classes, 3 types). All 38 new tests pass, no regressions (680/681 total pass, 1 pre-existing failure in PipelineStepFactory).

### Change Log

- 2026-04-06: Implemented EA9-S3 — SupervisorService + Session Logging & History (38 tests, 6 new files)
- 2026-04-06: Code review fixes — 7 issues resolved (3 HIGH, 4 MEDIUM): sessionId tracking in SupervisorService, immutable context enrichment, async I/O in SessionHistoryReader, safe escalation on missing question text, proper type casting in tests, barrel export docs. 2 new tests added (40 total).

### File List

- packages/sprint-core/src/features/bmad-orchestration/application/SessionLogger.ts (NEW)
- packages/sprint-core/src/features/bmad-orchestration/application/SessionHistoryReader.ts (NEW)
- packages/sprint-core/src/features/bmad-orchestration/application/SupervisorService.ts (NEW)
- packages/sprint-core/src/features/bmad-orchestration/__tests__/SessionLogger.test.ts (NEW)
- packages/sprint-core/src/features/bmad-orchestration/__tests__/SessionHistoryReader.test.ts (NEW)
- packages/sprint-core/src/features/bmad-orchestration/__tests__/SupervisorService.test.ts (NEW)
- packages/sprint-core/src/index.ts (MODIFIED — added exports for EA9-S1, S2, S3: classes, types, adapters)
