# Story E11.S13: SprintFormatter LLM Display

Status: ready-for-dev

## Story

As a Developer,
I want to see which LLM model is being used, how long each call takes, and how many tokens are consumed — in real-time in the CLI during sprint execution,
so that I can monitor LLM performance and costs while the sprint runs.

## Acceptance Criteria

1. During a sprint, SprintFormatter displays LLM calls inline:
   ```
   [E3-S16] dev (mistral:7b 2.3s 156t) ok reviewer (mistral:7b 1.1s 89t) ok -> done
   ```
   Format: `step (model duration tokens) status`
2. If no `llm.call.completed` events are emitted (tests without LLM), display falls back to current format without LLM info: `dev ok reviewer ok -> done` (backward compatible).

## Tasks / Subtasks

- [ ] Add LLM event buffer to SprintFormatter
  - [ ] File: `packages/app/src/cli/formatters/SprintFormatter.ts`
  - [ ] Add a `Map<string, { model: string; durationMs: number; tokenCount: number }>` to buffer the last LLM call data, keyed by `storyId + ':' + agentType`

- [ ] Subscribe to `llm.call.completed` in `attach()`
  - [ ] On `llm.call.completed`: store `{ model, durationMs, tokenCount }` in the buffer keyed by `storyId + ':' + agentType`
  - [ ] The `storyId` field is available in the event payload (set by LLMGateway from the call context)

- [ ] Modify `story.step.completed` handler to display LLM info
  - [ ] Before writing `${step} ok`, check if buffer has LLM data for `storyId + ':' + step`
  - [ ] If yes: write `${step} (${model} ${(durationMs/1000).toFixed(1)}s ${tokenCount}t) ok`
  - [ ] If no: write `${step} ok` (current behavior)
  - [ ] Clear the buffer entry after display

- [ ] Tests
  - [ ] Test with LLM events: verify formatted output includes model, duration, tokens
  - [ ] Test without LLM events: verify output unchanged from current format

## Dev Notes

- **Buffer strategy**: The `llm.call.completed` event fires during step execution, before `story.step.completed`. So the buffer is populated by the time we need to display. The key should match `storyId + ':' + agentType` where agentType comes from `llm.call.completed.agentType` and matches the step name in `story.step.completed.step`.
- **storyId in LLM events**: E5-S9 needs to include `storyId` in the `llm.call.completed` payload. The `completeForAgent()` context should pass the story context. If storyId is not available in LLMGateway (it doesn't know about stories), use `agentType` as the primary key and match with the current story being processed in SprintFormatter.
- **Simpler alternative**: Since SprintFormatter already tracks `storySteps` by storyId, and steps are processed sequentially, we can just buffer the _last_ `llm.call.completed` and display it on the next `story.step.completed`. This avoids needing storyId in LLM events entirely.
- **Display format**: Keep it compact — `(mistral:7b 2.3s 156t)` is readable in a terminal without being verbose.
