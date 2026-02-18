import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ImprovementPersistenceService } from '../application/ImprovementPersistenceService.js';
import type { ImprovementDecision } from '../application/ImprovementPersistenceService.js';

describe('ImprovementPersistenceService', () => {
  let testDir: string;
  let service: ImprovementPersistenceService;

  const makeDecision = (overrides?: Partial<ImprovementDecision>): ImprovementDecision => ({
    id: 'DEC-001',
    type: 'architecture-rule',
    description: 'Enforce hexagonal architecture',
    status: 'pending_review',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `cop1-improvement-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(testDir, { recursive: true });
    service = new ImprovementPersistenceService();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should persist a decision to JSONL', () => {
    const decision = makeDecision();
    service.persist(testDir, decision);

    const loaded = service.loadAll(testDir);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.id).toBe('DEC-001');
  });

  it('should load all persisted decisions', () => {
    service.persist(testDir, makeDecision({ id: 'DEC-001' }));
    service.persist(testDir, makeDecision({ id: 'DEC-002', type: 'quality' }));

    const loaded = service.loadAll(testDir);
    expect(loaded).toHaveLength(2);
  });

  it('should update the status of a decision', () => {
    service.persist(testDir, makeDecision({ id: 'DEC-001' }));

    const updated = service.updateStatus(testDir, 'DEC-001', 'approved');
    expect(updated).not.toBeNull();
    expect(updated?.status).toBe('approved');

    const loaded = service.loadAll(testDir);
    expect(loaded[0]?.status).toBe('approved');
  });

  it('should return empty array when file does not exist', () => {
    const emptyDir = join(
      tmpdir(),
      `cop1-empty-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(emptyDir, { recursive: true });

    const loaded = service.loadAll(emptyDir);
    expect(loaded).toHaveLength(0);

    rmSync(emptyDir, { recursive: true, force: true });
  });
});
