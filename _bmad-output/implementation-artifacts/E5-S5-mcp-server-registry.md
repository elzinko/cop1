# Story E5-S5: MCP Server Registry

Status: ready-for-dev

## Story
As an agent system
I want MCP Server Registry to provide tools for agents
so that agents can discover available capabilities

## Acceptance Criteria
- MCPRegistry.getToolsForAgent() returns available tools
- Registry discovers tools from multiple MCP servers
- Returns tool schemas and descriptions
- Supports filtering and searching for tools
- Caches tool definitions for performance

## Dev Notes
- Package: llm-intelligence
- Story Points: 5
