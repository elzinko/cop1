import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus } from '@cop1/shared-kernel';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockageService } from '../application/BlockageService.js';
import { BlocageEvent } from '../domain/Blocage.js';

describe('BlockageService', () => {
  let testDir: string;
  let eventBus: EventBus;
  let service: BlockageService;

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `cop1-blocage-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(testDir, { recursive: true });
    eventBus = new EventBus();
    service = new BlockageService(testDir, eventBus);
  });

  afterEach(() => {
    eventBus.removeAllListeners();
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should declare a blocage and persist it', () => {
    const blocage = service.declare('E1-S1', 'timeout', 'LLM took too long');

    expect(blocage.storyId).toBe('E1-S1');
    expect(blocage.type).toBe('timeout');
    expect(blocage.status).toBe('open');
    expect(service.list()).toHaveLength(1);
  });

  it('should emit story.blocked event on declare', () => {
    const handler = vi.fn();
    eventBus.on(BlocageEvent.STORY_BLOCKED, handler);

    service.declare('E1-S1', 'ambiguity', 'Unclear requirements');

    expect(handler).toHaveBeenCalledOnce();
    const payload = handler.mock.calls[0]?.[0] as { storyId: string; type: string };
    expect(payload.storyId).toBe('E1-S1');
    expect(payload.type).toBe('ambiguity');
  });

  it('should resolve a blocage', () => {
    const blocage = service.declare('E1-S1', 'technical', 'Build failure');
    const resolved = service.resolve(blocage.id, 'Fixed dependency version');

    expect(resolved.status).toBe('resolved');
    expect(resolved.response).toBe('Fixed dependency version');
  });

  it('should emit story.unblocked event on resolve', () => {
    const handler = vi.fn();
    eventBus.on(BlocageEvent.STORY_UNBLOCKED, handler);

    const blocage = service.declare('E1-S1', 'missing-access', 'Need API key');
    service.resolve(blocage.id, 'Key provided');

    expect(handler).toHaveBeenCalledOnce();
  });

  it('should list only open blocages', () => {
    service.declare('E1-S1', 'timeout', 'Reason 1');
    const b2 = service.declare('E1-S2', 'technical', 'Reason 2');
    service.resolve(b2.id, 'Fixed');

    expect(service.getOpen()).toHaveLength(1);
    expect(service.list()).toHaveLength(2);
  });

  it('should throw when resolving non-existent blocage', () => {
    expect(() => service.resolve('BLK-fake', 'response')).toThrow('Blocage not found');
  });
});
