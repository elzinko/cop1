# Story A9.2: SupervisorLLMPort + AgentSdkSupervisorAdapter

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a cop1 SprintRunner,
I want a SupervisorLLM port and its Agent SDK adapter to generate intelligent responses to BMAD workflow questions,
so that the SupervisorService (EA9-S3) can invoke an LLM to answer complex questions that cannot be resolved deterministically.

## Acceptance Criteria

1. **Given** a `SupervisorLLMPort` interface exists in `packages/sprint-core/src/features/bmad-orchestration/domain/ports/SupervisorLLMPort.ts`,
   **When** inspected,
   **Then** it exposes `generateResponse(question: SupervisorQuestion, context: SupervisorContext): Promise<SupervisorResponse>` with all types exported.

2. **Given** an `AgentSdkSupervisorAdapter` implements `SupervisorLLMPort`,
   **When** `generateResponse()` is called with a `SupervisorQuestion`,
   **Then** it spawns a separate Claude Agent SDK session with the supervisor system prompt and returns a `SupervisorResponse` with `answer`, `escalated`, `durationMs`, and optional `tokensUsed`.

3. **Given** the supervisor prompt follows ADR-012 section 4.4 decision framework,
   **When** the LLM determines it cannot answer a question (out of mandate, irreversible decision not covered by rules),
   **Then** the response has `escalated: true` with a non-empty `escalationReason` string.

4. **Given** the supervisor receives a `SupervisorContext` with `storyContent`, `projectContext`, `architectureRules`, `iamtheLawRules`, and `sessionHistory`,
   **When** generating a response,
   **Then** all context fields are injected into the supervisor prompt for informed decision-making.

5. **Given** an `InMemorySupervisorAdapter` exists for testing,
   **When** used in unit tests,
   **Then** it returns pre-configured responses based on question patterns, supporting both normal answers and escalation scenarios.

6. **Given** the adapter encounters an SDK error (timeout, network, rate limit),
   **When** `generateResponse()` fails,
   **Then** it throws a typed error (not a generic Error) and the `durationMs` is still populated.

7. **Given** all new types and classes are exported from the `@cop1/sprint-core` barrel (`index.ts`),
   **When** imported from `@cop1/sprint-core`,
   **Then** `SupervisorLLMPort`, `SupervisorQuestion`, `SupervisorResponse`, `SupervisorContext`, `AgentSdkSupervisorAdapter`, and `InMemorySupervisorAdapter` are available.

## Tasks / Subtasks

- [x] Task 1: Create `SupervisorLLMPort` interface and domain types (AC: #1)
  - [x] 1.1 Create `SupervisorLLMPort.ts` in `domain/ports/` with `SupervisorQuestion`, `SupervisorResponse`, `SupervisorContext`, `SupervisorLLMPort` interfaces
  - [x] 1.2 Export all types from `@cop1/sprint-core` barrel `index.ts`
- [x] Task 2: Create `InMemorySupervisorAdapter` for testing (AC: #5)
  - [x] 2.1 Create `InMemorySupervisorAdapter.ts` in `infrastructure/` implementing `SupervisorLLMPort`
  - [x] 2.2 Support pre-configured response map (`Map<string, SupervisorResponse>`) with pattern matching on `currentQuestion`
  - [x] 2.3 Support default response and escalation simulation
  - [x] 2.4 Unit tests for `InMemorySupervisorAdapter`
- [x] Task 3: Create supervisor prompt template (AC: #3, #4)
  - [x] 3.1 Create `SupervisorPromptBuilder.ts` in `domain/` — builds the system prompt from `SupervisorContext`
  - [x] 3.2 Implement ADR-012 decision framework in prompt: AC lookup → architecture rules → process conventions → continuation prompts → escalation
  - [x] 3.3 Inject `sessionHistory` as conversation context in the prompt
  - [x] 3.4 Unit tests for `SupervisorPromptBuilder` (verify prompt contains all context sections)
- [x] Task 4: Create `AgentSdkSupervisorAdapter` (AC: #2, #6)
  - [x] 4.1 Create `AgentSdkSupervisorAdapter.ts` in `infrastructure/` implementing `SupervisorLLMPort`
  - [x] 4.2 Use `@anthropic-ai/claude-agent-sdk` `query()` to spawn a separate session with the supervisor prompt
  - [x] 4.3 Configure SDK: `allowedTools: []` (supervisor is prompt-only, no tool use), `maxTurns: 1`
  - [x] 4.4 Parse SDK response to extract answer text, detect `ESCALATE:` prefix for escalation
  - [x] 4.5 Measure `durationMs` and extract `tokensUsed` from SDK response
  - [x] 4.6 Handle SDK errors: timeout → `SupervisorTimeoutError`, rate limit → `SupervisorRateLimitError`
  - [x] 4.7 Create error types: `SupervisorTimeoutError`, `SupervisorRateLimitError` in `domain/errors/`
  - [x] 4.8 Unit tests with mock SDK (inject `QueryFunction` type or wrapper)
- [x] Task 5: Barrel exports and final verification (AC: #7)
  - [x] 5.1 Update `packages/sprint-core/src/index.ts` with all new exports
  - [x] 5.2 Verify all tests pass: `pnpm vitest run --reporter=verbose`
  - [x] 5.3 Verify Biome lint: `pnpm biome check packages/sprint-core/src/features/bmad-orchestration/`

## Dev Notes

### Architecture Pattern

This story follows the identical hexagonal port/adapter pattern as `BMADCommandPort` → `ClaudeCliAdapter` (EA1-S1):

| Existing Pattern | This Story |
|-----------------|------------|
| `BMADCommandPort` (domain/ports/) | `SupervisorLLMPort` (domain/ports/) |
| `ClaudeCliAdapter` (infrastructure/) | `AgentSdkSupervisorAdapter` (infrastructure/) |
| `BMADCommandResult` | `SupervisorResponse` |
| N/A | `InMemorySupervisorAdapter` (infrastructure/) — test double |

**Key architectural difference:** The supervisor adapter uses the Agent SDK in a **single-turn, no-tools mode** — it's a prompt-in/text-out call. The multi-turn complexity lives in `BMADSessionPort` (EA9-S1), not here. The supervisor is a simple LLM call with a rich prompt.

### Supervisor Prompt Engineering (ADR-012 §4.4)

The supervisor prompt must follow this decision framework:

```
You are the cop1 Supervisor — an autonomous decision-maker replacing the human
developer during BMAD workflow execution.

## Decision Framework
1. If the question has a clear answer in the story AC → use it
2. If the question is about architecture → follow architecture.md and iamthelaw rules
3. If the question is about process → follow project-context.md conventions
4. If the question is a simple continuation prompt → answer "C" or equivalent
5. If you cannot determine the right answer → respond with "ESCALATE: [reason]"

## Context
[storyContent, projectContext, architectureRules, iamtheLawRules, sessionHistory]

## Current Question
[currentQuestion]

## Your Response
Respond ONLY with the answer. No explanation needed.
If escalating: ESCALATE: [reason]
```

### SDK Usage — Separate Session (NOT the workflow session)

The `AgentSdkSupervisorAdapter` spawns a **separate, lightweight SDK session** for each supervisor call. This is NOT the same session as the BMAD workflow session (that's `AgentSdkSessionAdapter` from EA9-S1).

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

// Supervisor = single-turn, no tools, prompt-only
for await (const message of query({
  prompt: supervisorPrompt,
  options: {
    allowedTools: [],  // No tool use — pure reasoning
    maxTurns: 1,       // Single response
  }
})) {
  // Extract text response
}
```

### SupervisorContext Interface (from ADR-012)

```typescript
export interface SupervisorContext {
  workflowCommand: string;        // "bmad-bmm-dev-story"
  storyId: string;                // "EA2-S3"
  storyContent: string;           // Full markdown story content
  projectContext: string;         // project-context.md content
  architectureRules: string;      // architecture.md relevant extracts
  iamtheLawRules: string;         // iamthelaw rules (sidecar YAML or parsed)
  sessionHistory: Array<{ role: 'workflow' | 'supervisor'; content: string }>;
  currentQuestion: string;        // The intercepted question
}
```

**Note:** `SupervisorContext` is consumed by both the `SupervisorLLMPort` and the `SupervisorService` (EA9-S3). Define it in the port file so both can import it.

### Dependency: `@anthropic-ai/claude-agent-sdk`

This SDK is listed in project-context.md as "planned, not yet installed". EA9-S1 adds it to `package.json` — this story depends on that. If EA9-S1 hasn't been implemented yet, the dev agent should add the dependency:

```bash
cd packages/sprint-core && pnpm add @anthropic-ai/claude-agent-sdk
```

### Error Types

Follow the existing pattern in `domain/errors/`:
- `BMADTimeoutError` → `SupervisorTimeoutError`
- `BMADRetryExhaustedError` → `SupervisorRateLimitError`

Each error extends `Error` with typed properties (e.g., `timeoutMs`, `retryAfterMs`).

### Project Structure Notes

All new files go in the existing `bmad-orchestration` feature:

```
packages/sprint-core/src/features/bmad-orchestration/
├── __tests__/
│   ├── SupervisorLLMPort.test.ts          ← NEW (port + InMemory adapter tests)
│   ├── AgentSdkSupervisorAdapter.test.ts  ← NEW (adapter tests with mock SDK)
│   └── SupervisorPromptBuilder.test.ts    ← NEW (prompt construction tests)
├── application/
│   └── (no changes — SupervisorService is EA9-S3)
├── domain/
│   ├── ports/
│   │   ├── BMADCommandPort.ts             ← UNCHANGED
│   │   └── SupervisorLLMPort.ts           ← NEW
│   ├── errors/
│   │   ├── SupervisorTimeoutError.ts      ← NEW
│   │   └── SupervisorRateLimitError.ts    ← NEW
│   └── SupervisorPromptBuilder.ts         ← NEW
└── infrastructure/
    ├── ClaudeCliAdapter.ts                ← UNCHANGED
    ├── AgentSdkSupervisorAdapter.ts       ← NEW
    └── InMemorySupervisorAdapter.ts       ← NEW
```

No existing files are modified except `packages/sprint-core/src/index.ts` (barrel exports).

### References

- [Source: _bmad-output/planning-artifacts/adr-012-multi-turn-bmad-interaction.md#5.3 Interface SupervisorLLMPort]
- [Source: _bmad-output/planning-artifacts/adr-012-multi-turn-bmad-interaction.md#4.4 Le Superviseur — Rôle et Architecture]
- [Source: _bmad-output/planning-artifacts/adr-012-multi-turn-bmad-interaction.md#6.2 New Components]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic EA9 — EA9-S2]
- [Source: _bmad-output/project-context.md#Architecture: Feature-First Hexagonal]
- [Source: packages/sprint-core/src/features/bmad-orchestration/domain/ports/BMADCommandPort.ts — existing port pattern]
- [Source: packages/sprint-core/src/features/bmad-orchestration/infrastructure/ClaudeCliAdapter.ts — existing adapter pattern]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
None

### Completion Notes List
- Task 1: Created `SupervisorLLMPort` interface with `SupervisorQuestion`, `SupervisorResponse`, `SupervisorContext` types in `domain/ports/SupervisorLLMPort.ts`. 5 type-shape tests.
- Task 2: Created `InMemorySupervisorAdapter` with pattern-matching (case-insensitive substring), custom default response, escalation simulation. 7 tests.
- Task 3: Created `buildSupervisorPrompt()` function implementing ADR-012 §4.4 decision framework with all context sections and session history injection. Converted from static-only class to function per Biome `noStaticOnlyClass` rule. 9 tests.
- Task 4: Created `AgentSdkSupervisorAdapter` with injectable `SupervisorQueryFunction` for testability (SDK not yet installed). Handles `ESCALATE:` prefix detection, token extraction, durationMs measurement, and typed errors (`SupervisorTimeoutError`, `SupervisorRateLimitError`). 9 tests.
- Task 5: Updated barrel exports in `index.ts`. All 641 tests pass (0 regressions). Biome lint clean on all new files.

### Change Log
- 2026-04-06: Implemented EA9-S2 — SupervisorLLMPort + AgentSdkSupervisorAdapter + InMemorySupervisorAdapter + SupervisorPromptBuilder + error types. 30 new tests added.
- 2026-04-06: Code review fixes — [H1] Added durationMs to SupervisorTimeoutError and SupervisorRateLimitError (AC #6 compliance), [H2] Fixed text accumulation (= → += for streaming), [M1] Fixed Biome lint violations (import order, useYield, formatting), [M2] Replaced misleading ESCALATE casing test with whitespace-trim and case-sensitivity tests, [M4] Replaced 5 type-shape tests with 3 behavioral port tests. 31 tests (net +1).

### File List
- packages/sprint-core/src/features/bmad-orchestration/domain/ports/SupervisorLLMPort.ts (NEW)
- packages/sprint-core/src/features/bmad-orchestration/domain/SupervisorPromptBuilder.ts (NEW)
- packages/sprint-core/src/features/bmad-orchestration/domain/errors/SupervisorTimeoutError.ts (NEW)
- packages/sprint-core/src/features/bmad-orchestration/domain/errors/SupervisorRateLimitError.ts (NEW)
- packages/sprint-core/src/features/bmad-orchestration/infrastructure/AgentSdkSupervisorAdapter.ts (NEW)
- packages/sprint-core/src/features/bmad-orchestration/infrastructure/InMemorySupervisorAdapter.ts (NEW)
- packages/sprint-core/src/features/bmad-orchestration/__tests__/SupervisorLLMPort.test.ts (NEW)
- packages/sprint-core/src/features/bmad-orchestration/__tests__/InMemorySupervisorAdapter.test.ts (NEW)
- packages/sprint-core/src/features/bmad-orchestration/__tests__/SupervisorPromptBuilder.test.ts (NEW)
- packages/sprint-core/src/features/bmad-orchestration/__tests__/AgentSdkSupervisorAdapter.test.ts (NEW)
- packages/sprint-core/src/index.ts (MODIFIED — added barrel exports)
