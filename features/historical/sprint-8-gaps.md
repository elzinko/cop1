# Feature Brief: Sprint 7 — Critical Gaps

## Context

cop1 has a working end-to-end pipeline: `cop1 sprint run --simulate` calls Ollama (mistral:7b), DevAgent generates code in a git worktree, ReviewerAgent judges, metrics are displayed in real-time (`dev (mistral:7b 44.0s 423t) ok`), and events are emitted on EventBus.

However, the quality of generated code is very poor because of 3 critical gaps.

---

## Gap 1: DevAgent Prompt Enrichment (CRITICAL)

### Problem
`DevAgent.run()` currently calls:
```typescript
const prompt = buildDevPrompt(context.storyId, `Story: ${context.storyId}`);
```

The LLM receives only `"Story: E10-S9"` — 10 words. It has NO access to:
- The story's acceptance criteria
- The subtasks / implementation details
- The dev notes (which package, which patterns, which files to modify)
- The project's tech stack (TypeScript, hexagonal architecture, Vitest, Biome)

Result: Mistral generates a generic React component `<div>{children}</div>` instead of actual useful code.

### What exists already
- `BMADReader.listStories()` returns `StoryMetadata` with `filePath` — the full path to the `.md` file
- The story `.md` files contain rich structured content: acceptance criteria, tasks/subtasks, dev notes
- `DevPromptTemplate.buildDevPrompt(storyId, snapshotContent)` already accepts a `snapshotContent` string — it's just called with a trivial value
- `WorkflowContext` has `storyId` and `projectPath` — the story file can be read from disk

### Proposed solution
1. Read the full story markdown content from `StoryMetadata.filePath` in SprintRunner before calling the workflow
2. Pass the story content through WorkflowContext (add `storyContent?: string` field)
3. DevAgent passes the full content to `buildDevPrompt()` instead of `"Story: ${storyId}"`
4. Optionally: enhance `buildDevPrompt()` to structure the content better for the LLM (extract AC, tasks, dev notes into clear sections)

### Files to modify
- `packages/sprint-core/src/features/workflow/domain/WorkflowContext.ts` — add `storyContent` field
- `packages/app/src/composition/SprintRunner.ts` — read story file, pass content in context
- `packages/sprint-core/src/features/dev-agent/application/DevAgent.ts` — use `context.storyContent` in prompt
- `packages/sprint-core/src/features/dev-agent/domain/DevPromptTemplate.ts` — optionally enhance prompt structure

---

## Gap 2: QA Agent Wiring

### Problem
`QAAgentStep` is a stub that sleeps 100ms and returns `{ status: 'ok' }`. No quality check happens after code generation. The existing `QualityGateService`, `CoverageGate`, and `StaticAnalysisGate` in `@cop1/quality-intelligence` are never called during the workflow.

### What exists already
- `QualityGateService` in `@cop1/quality-intelligence` — runs coverage + static analysis
- `CoverageGate` — parses vitest coverage JSON summary
- `StaticAnalysisGate` — runs Biome lint and extracts violations
- `ReviewerAgent` already has a `ReviewerPort` pattern we can follow
- The QA step receives `WorkflowContext` with `projectPath` (or worktree path in simulate mode)

### Proposed solution
Create a real `QAAgent` that:
1. Runs `pnpm test` in the worktree to verify tests pass
2. Runs `pnpm biome check .` for lint violations
3. Returns `failed` if tests fail or critical lint violations found
4. Returns `ok` with a quality report summary

This does NOT need an LLM — it's deterministic quality checks. Much simpler than DevAgent/ReviewerAgent.

### Files to create/modify
- `packages/sprint-core/src/features/qa-agent/application/QAAgent.ts` — new real QA agent
- `packages/app/src/composition/SprintRunner.ts` — replace `QAAgentStep()` with `QAAgent()`

---

## Gap 3: LoggerBridge Wiring in CLI

### Problem
`LoggerBridge` is implemented and tracks 9 event types (including `llm.call.started/completed`), but it's never instantiated in the `cop1 sprint run` CLI flow. Events are emitted on EventBus but never written to `.cop1/sprint-log-*.jsonl`.

The `DaemonService` wires a LoggerBridge for the daemon mode, but the CLI `sprint run` command doesn't.

### What exists already
- `LoggerBridge` in `@cop1/observability` — subscribes to EventBus, writes to StructuredLogger
- `StructuredLogger` in `@cop1/observability` — writes JSONL to `.cop1/sprint-log-YYYY-MM-DD.jsonl`
- `SprintRunner` has `this.eventBus` — all events are already emitted
- Just needs instantiation: `new LoggerBridge(eventBus, new StructuredLogger(projectPath)).start()`

### Proposed solution
Wire `LoggerBridge` + `StructuredLogger` in `SprintRunner.run()` after loading config. One-liner.

### Files to modify
- `packages/app/src/composition/SprintRunner.ts` — instantiate LoggerBridge

---

## Gap 4 (bonus): PM Agent Enhancement

### Problem
`PMAgentStep` is a stub. The existing `PMAgent` in `@cop1/sprint-core` has a real implementation with `BacklogPort`, but it's not wired.

### What exists already
- `PMAgent` in `packages/sprint-core/src/features/pm-agent/application/PMAgent.ts`
- `PMDecisionService` in `packages/sprint-core/src/features/pm-decision/application/PMDecisionService.ts`
- `BacklogPort` interface

### Proposed solution
This is lower priority. The PM agent could validate that the story was properly completed (all AC met) by asking the LLM to review the generated code against the acceptance criteria. But this requires Gap 1 (story content) to be resolved first.

---

## Priority Order

1. **Gap 1: Prompt Enrichment** — CRITICAL, transforms useless output into useful code
2. **Gap 3: LoggerBridge** — EASY (one-liner), enables audit trail
3. **Gap 2: QA Agent** — MEDIUM, adds real quality gates
4. **Gap 4: PM Agent** — LOW priority, depends on Gap 1

## Technical Context
- Monorepo: 8 packages, feature-first hexagonal architecture
- Stack: TypeScript strict (NodeNext), Vitest, Biome, pnpm workspaces
- LLM: Ollama in Docker (mistral:7b, 4.4GB), MacBook Pro M3 Max 64GB
- 415 tests passing, 101 stories implemented
