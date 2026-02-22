# Story E3.S18: PM Agent Wiring

Status: ready-for-dev

## Story

As a Developer,
I want the PM step in the sprint workflow to validate that acceptance criteria have been addressed by the generated code,
so that I get a validation report for each story processed by the pipeline.

## Acceptance Criteria

1. `PMAgentStep` is replaced by a real `PMAgentWorkflowStep` implementing `WorkflowStep`. It receives `context.storyContent` and validates that acceptance criteria have been addressed by the generated code — producing a markdown validation report.
2. If PM agent cannot validate (no storyContent, or LLM unavailable), it returns `{ status: 'ok' }` with a warning — never blocks the pipeline on the PM step in MVP.

## Tasks / Subtasks

- [ ] Create `PMAgentWorkflowStep` class
  - [ ] File: `packages/sprint-core/src/features/pm-agent/application/PMAgentWorkflowStep.ts`
  - [ ] Implements `WorkflowStep` interface (`name = 'pm'`, `run(context): Promise<StepResult>`)
  - [ ] Extract ACs from `context.storyContent` using markdown parsing (reuse `extractMarkdownSection` from E3-S17)
  - [ ] For each AC, check if the generated code (from previous workflow step results) addresses it using heuristic matching
  - [ ] Produce a markdown validation report with AC-by-AC status (addressed / not addressed / unclear)
  - [ ] Return `{ status: 'ok', report }` — never return `'failed'` (PM step is informational in MVP)

- [ ] Handle graceful fallback scenarios
  - [ ] No `storyContent` in context → return `{ status: 'ok' }` with warning "No story content available for PM validation"
  - [ ] No ACs found in story → return `{ status: 'ok' }` with warning "No acceptance criteria found"
  - [ ] Any error during validation → catch and return `{ status: 'ok' }` with error details in report

- [ ] Wire `PMAgentWorkflowStep` in SprintRunner
  - [ ] File: `packages/app/src/composition/SprintRunner.ts`
  - [ ] Replace `new PMAgentStep()` with `new PMAgentWorkflowStep()`
  - [ ] Update imports accordingly
  - [ ] Remove old `PMAgentStep` import

- [ ] Export from package barrel
  - [ ] Update `packages/sprint-core/src/index.ts` to export `PMAgentWorkflowStep`

- [ ] Tests unitaires
  - [ ] Test with story content containing ACs → produces validation report
  - [ ] Test without story content → returns ok with warning
  - [ ] Test with story content but no ACs section → returns ok with warning
  - [ ] Test never returns `{ status: 'failed' }` even on internal error
  - [ ] Verify `name` property is `'pm'`

## Dev Notes

- Two implementation options for AC validation:
  - **Option A (LLM-based):** Send the story ACs + generated code summary to the LLM and ask "Were these ACs addressed?" — requires LLMGateway injection, richer output
  - **Option B (Heuristic):** Parse ACs from story content and check if generated file names/content match expected patterns — simpler, no LLM dependency
  - **Recommendation:** Start with Option B for MVP reliability. Option A can be added later when prompt quality (E3-S17) is proven.
- The existing `PMAgent` class (`backlogHealthReport()`, `estimateEffort()`) serves a different purpose (backlog analysis). The new `PMAgentWorkflowStep` is about post-implementation validation — different responsibility, different class.
- The step MUST be graceful: never fail the pipeline. In MVP, PM validation is informational, not blocking.
- Depends on E3-S17 because PM validation of ACs requires the same story content parsing capabilities (`extractMarkdownSection`).
- **Current stub** (for reference):
  ```typescript
  export class PMAgentStep implements WorkflowStep {
    name = 'pm';
    async run(_context: WorkflowContext): Promise<StepResult> {
      await new Promise((r) => setTimeout(r, 100));
      return { status: 'ok' };
    }
  }
  ```
