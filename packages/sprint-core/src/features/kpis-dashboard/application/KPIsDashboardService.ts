export interface SprintKPIs {
  velocity: number;
  blocageRate: number;
  dodRejectionRate: number;
  coveragePercent: number;
  storiesCompleted: number;
  storiesPlanned: number;
}

export interface KPITrend {
  velocityTrend: 'up' | 'down' | 'stable';
  avgBlockageRate: number;
  avgCoverage: number;
}

export interface SprintData {
  completed: number;
  planned: number;
  blocages: number;
  dodRejections: number;
  totalReviews: number;
  coveragePercent: number;
}

export class KPIsDashboardService {
  computeKPIs(sprintData: SprintData): SprintKPIs {
    const { completed, planned, blocages, dodRejections, totalReviews, coveragePercent } =
      sprintData;

    return {
      velocity: completed,
      blocageRate: planned > 0 ? blocages / planned : 0,
      dodRejectionRate: totalReviews > 0 ? dodRejections / totalReviews : 0,
      coveragePercent,
      storiesCompleted: completed,
      storiesPlanned: planned,
    };
  }

  computeTrend(kpiHistory: SprintKPIs[]): KPITrend {
    if (kpiHistory.length === 0) {
      return { velocityTrend: 'stable', avgBlockageRate: 0, avgCoverage: 0 };
    }

    const avgBlockageRate =
      kpiHistory.reduce((sum, k) => sum + k.blocageRate, 0) / kpiHistory.length;
    const avgCoverage =
      kpiHistory.reduce((sum, k) => sum + k.coveragePercent, 0) / kpiHistory.length;

    let velocityTrend: KPITrend['velocityTrend'] = 'stable';
    if (kpiHistory.length >= 2) {
      const first = kpiHistory[0]?.velocity ?? 0;
      const last = kpiHistory[kpiHistory.length - 1]?.velocity ?? 0;
      if (last > first) {
        velocityTrend = 'up';
      } else if (last < first) {
        velocityTrend = 'down';
      }
    }

    return { velocityTrend, avgBlockageRate, avgCoverage };
  }
}
