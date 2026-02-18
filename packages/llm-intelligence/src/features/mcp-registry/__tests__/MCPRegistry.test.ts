import { describe, expect, it } from 'vitest';
import { MCPRegistry, MCPUnauthorizedError } from '../application/MCPRegistry.js';

describe('MCPRegistry', () => {
  const tools = [
    { name: 'file_read', description: 'Read files' },
    { name: 'file_write', description: 'Write files' },
    { name: 'git_commit', description: 'Git commit' },
    { name: 'review_submit', description: 'Submit review' },
  ];

  const permissions = {
    'dev-agent': ['file_read', 'file_write', 'git_commit'],
    'reviewer-agent': ['file_read', 'review_submit'],
  };

  it('should return only allowed tools for an agent', () => {
    const registry = new MCPRegistry(permissions, tools);
    const devTools = registry.getToolsForAgent('dev-agent');

    expect(devTools).toHaveLength(3);
    expect(devTools.map((t) => t.name)).toContain('git_commit');
    expect(devTools.map((t) => t.name)).not.toContain('review_submit');
  });

  it('should throw MCPUnauthorizedError on unauthorized access', () => {
    const registry = new MCPRegistry(permissions, tools);

    expect(() => registry.assertAccess('dev-agent', 'review_submit')).toThrow(MCPUnauthorizedError);
  });

  it('should allow authorized access without throwing', () => {
    const registry = new MCPRegistry(permissions, tools);

    expect(() => registry.assertAccess('dev-agent', 'file_read')).not.toThrow();
  });

  it('should return empty tools for unknown agent', () => {
    const registry = new MCPRegistry(permissions, tools);
    expect(registry.getToolsForAgent('unknown')).toHaveLength(0);
  });
});
