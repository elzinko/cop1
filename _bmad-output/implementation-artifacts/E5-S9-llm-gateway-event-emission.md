# Story E5.S9: LLMGateway Event Emission

Status: ready-for-dev

## Story

As a Developer,
I want the LLMGateway to emit events for every LLM call (started/completed),
so that the observability pipeline (logger, monitor, formatter) can track LLM usage in real-time.

## Acceptance Criteria

1. `LLMGateway` accepts an optional `EventBus` in its constructor — `new LLMGateway(provider, eventBus?)`. When present, every `complete()` and `completeForAgent()` call emits `llm.call.started` (before streaming) and `llm.call.completed` (after full `AsyncIterable` consumption).
2. The `llm.call.completed` payload contains: `{ model, agentType, promptLength, responseLength, durationMs, tokenCount }` — `tokenCount` is estimated as `Math.ceil(responseLength / 4)` (chars/4 approximation, sufficient for MVP).
3. If no EventBus is provided, LLMGateway works exactly as before (full backward compatibility — no existing test breaks).

## Tasks / Subtasks

- [ ] Modify `LLMGateway` constructor to accept optional `EventBus`
  - [ ] File: `packages/llm-intelligence/src/features/llm-gateway/application/LLMGateway.ts`
  - [ ] Add second constructor parameter: `private readonly eventBus?: EventBus`
  - [ ] Import `EventBus` from `@cop1/shared-kernel`

- [ ] Create a wrapping async generator for event emission
  - [ ] Private method `trackCompletion(stream, model, agentType, promptLength)` that:
    - Emits `llm.call.started` with `{ model, agentType, promptLength, timestamp }`
    - Records `startTime = Date.now()`
    - Yields each `LLMChunk` from the inner stream while accumulating `responseLength`
    - On `done: true`, emits `llm.call.completed` with `{ model, agentType, promptLength, responseLength, durationMs, tokenCount }`
  - [ ] If no eventBus, return the raw stream unchanged

- [ ] Wrap `complete()` and `completeForAgent()` with `trackCompletion()`
  - [ ] `complete(prompt, model, options)`: agentType = `'direct'`
  - [ ] `completeForAgent(commandType, prompt, options)`: agentType = `commandType`

- [ ] Update `SprintRunner.buildRealSteps()` to pass EventBus
  - [ ] File: `packages/app/src/composition/SprintRunner.ts`
  - [ ] Change: `new LLMGateway(ollama).withRouter(...)` → `new LLMGateway(ollama, this.eventBus).withRouter(...)`

- [ ] Tests unitaires
  - [ ] Test with EventBus: verify `llm.call.started` and `llm.call.completed` are emitted with correct payload
  - [ ] Test without EventBus: verify existing behavior unchanged (no crash, no events)
  - [ ] Test `tokenCount` estimation: `responseLength` of 400 chars → `tokenCount` of 100
  - [ ] Verify all existing LLMGateway tests still pass unchanged

## Dev Notes

- **Pattern**: The `complete()` method returns `AsyncIterable<LLMChunk>`. To track completion, wrap the iterable in an async generator that intercepts chunks. This is non-invasive — consumers of the iterable see the exact same chunks.
- **Event names**: Follow existing dot-notation convention (`llm.call.started`, `llm.call.completed`). The prefix `llm.` already exists in the codebase (e.g., `llm.escalated` in AdaptiveLLMService).
- **`llm.call.started` payload**: `{ model: string, agentType: string, promptLength: number, timestamp: string }`
- **`llm.call.completed` payload**: `{ model: string, agentType: string, promptLength: number, responseLength: number, durationMs: number, tokenCount: number }`
- **Token estimation**: `Math.ceil(responseLength / 4)` is a rough approximation. Ollama's `/api/generate` with `stream: false` returns `eval_count` (actual tokens) but streaming doesn't. This estimation is acceptable for MVP. Can be refined later using Ollama's response metadata.
- **Backward compatibility is critical**: The EventBus parameter is optional. All existing tests that create `new LLMGateway(provider)` must continue to work without modification.
