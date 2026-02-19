# Feature Brief: LLM Observability & Invocation History

## Problem
When cop1 runs a sprint with real LLM agents (Ollama), there is no visibility on:
- Which models are called, when, and for how long
- How many tokens are consumed per agent/story
- Performance metrics (tokens/sec)
- History of all LLM invocations for audit and debugging

The StructuredLogger and LoggerBridge exist but only track workflow events (story.started, step.completed). LLM calls pass "silently" through LLMGateway without emitting any event.

## Proposed Solution
Wire LLM call tracking into the existing EventBus + StructuredLogger pipeline:

1. **LLMGateway emits events** — `llm.call.started` and `llm.call.completed` with model, agentType, prompt length, response length, duration, token count
2. **LoggerBridge subscribes** to these new events and writes them to `.cop1/sprint-log-YYYY-MM-DD.jsonl`
3. **TokensPerSecMonitor wired** — records measurements from completed calls, available for performance checks
4. **OllamaManagementAdapter wired** — `cop1 sprint status` shows available Ollama models
5. **CLI output** — SprintFormatter displays LLM call info in real-time (model, duration, tokens)

## Existing Components (already implemented, need wiring)
- `LLMGateway` — central LLM call point (`packages/llm-intelligence`)
- `EventBus` — pub-sub (`packages/shared-kernel`)
- `StructuredLogger` + `LoggerBridge` — JSONL logging (`packages/observability`)
- `TokensPerSecMonitor` — tokens/sec tracking (`packages/llm-intelligence`)
- `OllamaManagementAdapter` — list/pull/delete models (`packages/llm-intelligence`)
- `SprintFormatter` — real-time CLI output (`packages/app`)

## User Value
- Developer can see in real-time which model is being called and how long it takes
- After a sprint, developer can review `.cop1/sprint-log-*.jsonl` for full LLM call history
- `cop1 sprint status` shows available Ollama models and their sizes
- Performance data available for future adaptive escalation (fallback to bigger model if too slow)

## Hardware Context
- MacBook Pro M3 Max 64GB RAM
- Ollama runs in Docker container
- Current model: mistral:7b (4.4GB)
