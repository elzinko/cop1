# EA10-S7 — Agent SDK MCP integration spike

**Date:** 2026-04-14
**Goal:** Validate `createSdkMcpServer` + `tool()` API in `@anthropic-ai/claude-agent-sdk@0.1.77` before building the full supervisor tool catalog.

## Findings

### API surface (confirmed)

```ts
// @anthropic-ai/claude-agent-sdk/entrypoints/agentSdkTypes.d.ts
export declare function tool<Schema extends AnyZodRawShape>(
  name: string,
  description: string,
  inputSchema: Schema,
  handler: (args: InferShape<Schema>, extra: unknown) => Promise<CallToolResult>,
): SdkMcpToolDefinition<Schema>;

export declare function createSdkMcpServer(options: {
  name: string;
  tools: SdkMcpToolDefinition<unknown>[];
}): McpSdkServerConfigWithInstance;
```

Both symbols are stable in 0.1.77. Zod is the expected schema library (`AnyZodRawShape`).

### Tool handler return shape

`CallToolResult` = `{ content: Array<{ type: 'text'; text: string } | ...> }`. For V1-light we stringify JSON into a single text block — consumer LLM parses it.

### MCP wiring into `query()`

A supervisor session starts via `query({ prompt, options: { mcpServers: { cop1: mcpServer }, ... } })`. The `mcpServers` key takes a record of `McpSdkServerConfigWithInstance` objects.

### Scope isolation

BMAD internal agent sessions (invoked via `invoke_bmad_command`) do NOT receive the `mcpServers` option — they get a clean `query()` call. This satisfies ADR-014 §5.1/§5.2 at zero additional cost.

### Error surfaces

A thrown error inside a `tool()` handler propagates back to the LLM as a tool failure. The supervisor's multi-step loop (EA10-S8) handles these by transitioning from `consulting` → `synthesizing` or `escalated`.

### Re-entrance

The SDK serializes tool calls (single queue), so `invoke_bmad_command` cannot be called concurrently by the supervisor. Re-entrance happens only if a BMAD sub-session itself invokes a cop1 tool — not possible since BMAD sessions have no MCP access. Still, we maintain an in-process counter as belt-and-suspenders (ADR-014 §5.7).

## Decisions

1. Place `toolCatalog.ts` + `SupervisorMcpServer.ts` in `sprint-core/features/bmad-orchestration/infrastructure/tools/` — sprint-core already depends on the SDK and zod.
2. Lazy-load the SDK inside `buildSupervisorMcpServer` via dynamic import so `toolCatalog.ts` stays SDK-free and testable.
3. Use `JSON.stringify` for all tool outputs — deferred typing of `CallToolResult` (SDK ships structured content types; V1-light sticks to text).

## Risks deferred

- `commit_anchor` is a stub returning `{ committed: false, note: '...' }`. Real git integration (one commit per BMAD workflow per ADR-014 §5.6) is a follow-up.
- Real session wiring into `query()` via `mcpServers` option happens in the `SupervisorService` update that EA10-S8 ships.
