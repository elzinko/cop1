import type { DORValidationResult, DimensionResult } from '../domain/DORResult.js';

export interface StorySnapshot {
  id: string;
  title: string;
  acceptanceCriteria: string[];
  effortEstimate: number | null;
  dependencies: string[];
  teamCompetencies: string[];
  requiredCompetencies: string[];
  infraAccess: string[];
  requiredAccess: string[];
}

export class DORValidator {
  validate(snapshot: StorySnapshot): DORValidationResult {
    const dimensions: DimensionResult[] = [
      this.checkStoryQuality(snapshot),
      this.checkTeamReadiness(snapshot),
      this.checkInfraAccess(snapshot),
    ];

    return {
      passed: dimensions.every((d) => d.passed),
      dimensions,
    };
  }

  private checkStoryQuality(snapshot: StorySnapshot): DimensionResult {
    const missing: string[] = [];

    if (snapshot.acceptanceCriteria.length === 0) {
      missing.push('acceptance_criteria');
    }
    if (snapshot.effortEstimate === null) {
      missing.push('effort_estimate');
    }
    if (snapshot.dependencies.length > 0) {
      missing.push('unresolved_dependencies');
    }

    return { name: 'story_quality', passed: missing.length === 0, missing };
  }

  private checkTeamReadiness(snapshot: StorySnapshot): DimensionResult {
    const missing: string[] = [];
    for (const required of snapshot.requiredCompetencies) {
      if (!snapshot.teamCompetencies.includes(required)) {
        missing.push(`competency:${required}`);
      }
    }
    return { name: 'team_readiness', passed: missing.length === 0, missing };
  }

  private checkInfraAccess(snapshot: StorySnapshot): DimensionResult {
    const missing: string[] = [];
    for (const required of snapshot.requiredAccess) {
      if (!snapshot.infraAccess.includes(required)) {
        missing.push(`access:${required}`);
      }
    }
    return { name: 'infra_access', passed: missing.length === 0, missing };
  }
}
