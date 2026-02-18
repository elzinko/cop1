export class MCPUnauthorizedError extends Error {
  constructor(
    public readonly agentName: string,
    public readonly toolName: string,
  ) {
    super(`Agent '${agentName}' is not authorized to use tool '${toolName}'`);
    this.name = 'MCPUnauthorizedError';
  }
}

export interface MCPTool {
  name: string;
  description: string;
}

export class MCPRegistry {
  private permissions: Record<string, string[]>;
  private tools: MCPTool[];

  constructor(permissions: Record<string, string[]> = {}, tools: MCPTool[] = []) {
    this.permissions = permissions;
    this.tools = tools;
  }

  getToolsForAgent(agentName: string): MCPTool[] {
    const allowed = this.permissions[agentName];
    if (!allowed) return [];
    return this.tools.filter((t) => allowed.includes(t.name));
  }

  assertAccess(agentName: string, toolName: string): void {
    const allowed = this.permissions[agentName];
    if (!allowed || !allowed.includes(toolName)) {
      throw new MCPUnauthorizedError(agentName, toolName);
    }
  }

  updatePermissions(permissions: Record<string, string[]>): void {
    this.permissions = permissions;
  }

  registerTools(tools: MCPTool[]): void {
    this.tools = tools;
  }
}
