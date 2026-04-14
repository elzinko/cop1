import { type ToolCatalogDeps, buildSupervisorToolHandlers, toolSchemas } from './toolCatalog.js';

/**
 * Builds the in-process MCP server exposing the cop1 supervisor tool catalog
 * (ADR-014 §4.2 / §4.4).
 *
 * SDK lazy-loaded via dynamic import to keep the rest of `sprint-core`
 * testable without the SDK on disk.
 */
export async function buildSupervisorMcpServer(
  deps: ToolCatalogDeps & { budgetProvider?: () => number },
): Promise<{
  server: unknown;
  handlers: ReturnType<typeof buildSupervisorToolHandlers>;
}> {
  const handlers = buildSupervisorToolHandlers(deps);
  const sdk = (await import('@anthropic-ai/claude-agent-sdk')) as {
    tool: (...args: unknown[]) => unknown;
    createSdkMcpServer: (options: unknown) => unknown;
  };
  const tools = [
    sdk.tool(
      'create_worktree',
      'Create a git worktree for a story',
      toolSchemas.create_worktree,
      async (input: Parameters<typeof handlers.create_worktree>[0]) =>
        ({
          content: [{ type: 'text', text: JSON.stringify(await handlers.create_worktree(input)) }],
        }) as unknown,
    ),
    sdk.tool(
      'cleanup_worktree',
      'Remove a git worktree',
      toolSchemas.cleanup_worktree,
      async (input: Parameters<typeof handlers.cleanup_worktree>[0]) =>
        ({
          content: [{ type: 'text', text: JSON.stringify(await handlers.cleanup_worktree(input)) }],
        }) as unknown,
    ),
    sdk.tool(
      'invoke_bmad_command',
      'Invoke a BMAD slash command in a fresh session',
      toolSchemas.invoke_bmad_command,
      async (input: Parameters<typeof handlers.invoke_bmad_command>[0]) =>
        ({
          content: [
            { type: 'text', text: JSON.stringify(await handlers.invoke_bmad_command(input)) },
          ],
        }) as unknown,
    ),
    sdk.tool(
      'query_session_history',
      'Query past supervisor session history by story or session id',
      toolSchemas.query_session_history,
      async (input: Parameters<typeof handlers.query_session_history>[0]) =>
        ({
          content: [
            { type: 'text', text: JSON.stringify(await handlers.query_session_history(input)) },
          ],
        }) as unknown,
    ),
    sdk.tool(
      'commit_anchor',
      'Commit the current worktree with the given message (one commit per workflow, ADR-014 §5.6)',
      toolSchemas.commit_anchor,
      async (input: Parameters<typeof handlers.commit_anchor>[0]) =>
        ({
          content: [{ type: 'text', text: JSON.stringify(await handlers.commit_anchor(input)) }],
        }) as unknown,
    ),
    sdk.tool(
      'remaining_budget',
      'Return the remaining token budget for the long-running supervisor session',
      toolSchemas.remaining_budget,
      async () =>
        ({
          content: [{ type: 'text', text: JSON.stringify(await handlers.remaining_budget({})) }],
        }) as unknown,
    ),
  ];

  const server = sdk.createSdkMcpServer({
    name: 'cop1-supervisor-tools',
    tools,
  });

  return { server, handlers };
}
