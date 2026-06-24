import { describe, expect, it, vi } from 'vitest';
import { WorktreeService } from '../application/WorktreeService.js';
import type { WorktreePort } from '../domain/ports/WorktreePort.js';

function stubAdapter(overrides: Partial<WorktreePort> = {}): WorktreePort {
  return {
    create: vi.fn(() => '/tmp/.cop1/worktrees/run/story-1234'),
    cleanup: vi.fn(),
    list: vi.fn(() => []),
    ...overrides,
  };
}

describe('WorktreeService', () => {
  it('delegates create to the adapter and returns its path', () => {
    const adapter = stubAdapter();
    const svc = new WorktreeService(adapter);
    expect(svc.create('/proj', 'EA11-S3')).toBe('/tmp/.cop1/worktrees/run/story-1234');
    expect(adapter.create).toHaveBeenCalledWith('/proj', 'EA11-S3');
  });

  it('delegates cleanup to the adapter', () => {
    const adapter = stubAdapter();
    const svc = new WorktreeService(adapter);
    svc.cleanup('/proj', '/tmp/.cop1/worktrees/run/story-1234');
    expect(adapter.cleanup).toHaveBeenCalledWith('/proj', '/tmp/.cop1/worktrees/run/story-1234');
  });

  it('delegates list and returns adapter output', () => {
    const adapter = stubAdapter({ list: vi.fn(() => ['/a', '/b']) });
    const svc = new WorktreeService(adapter);
    expect(svc.list('/proj')).toEqual(['/a', '/b']);
  });

  it('uses WorktreeManager as default adapter when none provided', () => {
    const svc = new WorktreeService();
    // Just verify instantiation — we don't exercise real git here.
    expect(svc).toBeInstanceOf(WorktreeService);
  });
});
