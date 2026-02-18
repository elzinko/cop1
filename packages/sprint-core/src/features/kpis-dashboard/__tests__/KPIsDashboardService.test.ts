import { beforeEach, describe, expect, it } from 'vitest';
import { KPIsDashboardService } from '../application/KPIsDashboardService.js';
import type { SprintKPIs } from '../application/KPIsDashboardService.js';

describe('KPIsDashboardService', () => {
  let service: KPIsDashboardService;

  beforeEach(() => {
    service = new KPIsDashboardService();
  });

  it('should compute basic KPIs', () => {
    const kpis = service.computeKPIs({
      completed: 8,
      planned: 10,
      blocages: 2,
      dodRejections: 1,
      totalReviews: 5,
      coveragePercent: 85,
    });

    expect(kpis.velocity).toBe(8);
    expect(kpis.blocageRate).toBeCloseTo(0.2);
    expect(kpis.dodRejectionRate).toBeCloseTo(0.2);
    expect(kpis.coveragePercent).toBe(85);
    expect(kpis.storiesCompleted).toBe(8);
    expect(kpis.storiesPlanned).toBe(10);
  });

  it('should be safe with zero division', () => {
    const kpis = service.computeKPIs({
      completed: 0,
      planned: 0,
      blocages: 0,
      dodRejections: 0,
      totalReviews: 0,
      coveragePercent: 0,
    });

    expect(kpis.blocageRate).toBe(0);
    expect(kpis.dodRejectionRate).toBe(0);
  });

  it('should detect upward velocity trend', () => {
    const history: SprintKPIs[] = [
      {
        velocity: 5,
        blocageRate: 0.2,
        dodRejectionRate: 0.1,
        coveragePercent: 80,
        storiesCompleted: 5,
        storiesPlanned: 10,
      },
      {
        velocity: 8,
        blocageRate: 0.1,
        dodRejectionRate: 0.1,
        coveragePercent: 85,
        storiesCompleted: 8,
        storiesPlanned: 10,
      },
      {
        velocity: 12,
        blocageRate: 0.05,
        dodRejectionRate: 0.05,
        coveragePercent: 90,
        storiesCompleted: 12,
        storiesPlanned: 12,
      },
    ];

    const trend = service.computeTrend(history);
    expect(trend.velocityTrend).toBe('up');
  });

  it('should detect downward velocity trend', () => {
    const history: SprintKPIs[] = [
      {
        velocity: 12,
        blocageRate: 0.1,
        dodRejectionRate: 0.1,
        coveragePercent: 90,
        storiesCompleted: 12,
        storiesPlanned: 12,
      },
      {
        velocity: 8,
        blocageRate: 0.2,
        dodRejectionRate: 0.1,
        coveragePercent: 85,
        storiesCompleted: 8,
        storiesPlanned: 10,
      },
      {
        velocity: 5,
        blocageRate: 0.3,
        dodRejectionRate: 0.2,
        coveragePercent: 80,
        storiesCompleted: 5,
        storiesPlanned: 10,
      },
    ];

    const trend = service.computeTrend(history);
    expect(trend.velocityTrend).toBe('down');
  });

  it('should detect stable velocity trend', () => {
    const history: SprintKPIs[] = [
      {
        velocity: 10,
        blocageRate: 0.1,
        dodRejectionRate: 0.1,
        coveragePercent: 85,
        storiesCompleted: 10,
        storiesPlanned: 10,
      },
      {
        velocity: 10,
        blocageRate: 0.1,
        dodRejectionRate: 0.1,
        coveragePercent: 85,
        storiesCompleted: 10,
        storiesPlanned: 10,
      },
    ];

    const trend = service.computeTrend(history);
    expect(trend.velocityTrend).toBe('stable');
  });
});
