# Story E5.S10: LoggerBridge LLM Event Tracking

Status: ready-for-dev

## Story

As a Developer,
I want LLM call events to be automatically written to the sprint log JSONL file,
so that I can review all LLM invocations after a sprint for debugging and audit.

## Acceptance Criteria

1. `TRACKED_EVENTS` in LoggerBridge includes `'llm.call.started'` and `'llm.call.completed'` — LLM events are written to the sprint-log JSONL with the same format as existing workflow events.
2. After a sprint with real Ollama agents, the file `.cop1/sprint-log-{date}.jsonl` contains `llm.call.completed` entries with `model`, `durationMs` and `tokenCount` verifiable by grep.

## Tasks / Subtasks

- [ ] Add LLM events to TRACKED_EVENTS
  - [ ] File: `packages/observability/src/features/logger/application/LoggerBridge.ts`
  - [ ] Add `'llm.call.started'` and `'llm.call.completed'` to the `TRACKED_EVENTS` array

- [ ] Test
  - [ ] Verify LoggerBridge subscribes to `llm.call.started` and `llm.call.completed` when `start()` is called
  - [ ] Verify emitting `llm.call.completed` on EventBus produces a JSONL entry via StructuredLogger

## Dev Notes

- **Minimal change**: This is a 2-line addition to the `TRACKED_EVENTS` array. The LoggerBridge generic subscription loop handles the rest.
- **No format change**: The StructuredLogger already handles arbitrary payloads via `Record<string, unknown>`. The LLM event payloads (model, durationMs, tokenCount, etc.) will be serialized as-is into the JSONL entries.
- **Depends on E5-S9**: Without LLMGateway emitting events, there's nothing to track. But the LoggerBridge change can be implemented and tested independently with a mock EventBus.
