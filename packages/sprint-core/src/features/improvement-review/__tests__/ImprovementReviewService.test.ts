import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ImprovementPersistenceService } from '../../improvement-persistence/application/ImprovementPersistenceService.js';
import type { ImprovementDecision } from '../../improvement-persistence/application/ImprovementPersistenceService.js';
import { ImprovementReviewService } from '../application/ImprovementReviewService.js';

describe('ImprovementReviewService', () => {
  let testDir: string;
  let persistenceService: ImprovementPersistenceService;
  let service: ImprovementReviewService;

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
      `cop1-review-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(testDir, { recursive: true });
    persistenceService = new ImprovementPersistenceService();
    service = new ImprovementReviewService(persistenceService);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should group decisions by type', () => {
    const decisions: ImprovementDecision[] = [
      makeDecision({ id: 'DEC-001', type: 'architecture-rule' }),
      makeDecision({ id: 'DEC-002', type: 'quality' }),
      makeDecision({ id: 'DEC-003', type: 'architecture-rule' }),
    ];

    const grouped = service.getGrouped(decisions);
    expect(grouped['architecture-rule']).toHaveLength(2);
    expect(grouped.quality).toHaveLength(1);
  });

  it('should approve a decision', () => {
    persistenceService.persist(testDir, makeDecision({ id: 'DEC-001' }));

    const result = service.approve(testDir, 'DEC-001');
    expect(result).not.toBeNull();
    expect(result?.status).toBe('approved');
  });

  it('should reject a decision', () => {
    persistenceService.persist(testDir, makeDecision({ id: 'DEC-001' }));

    const result = service.reject(testDir, 'DEC-001', 'Not applicable');
    expect(result).not.toBeNull();
    expect(result?.status).toBe('rejected');
  });

  it('should return null for missing id', () => {
    const result = service.approve(testDir, 'DEC-NONEXISTENT');
    expect(result).toBeNull();
  });
});
