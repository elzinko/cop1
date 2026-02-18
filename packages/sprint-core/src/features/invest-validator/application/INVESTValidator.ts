export interface INVESTResult {
  score: number;
  failedCriteria: string[];
  passed: boolean;
}

export interface INVESTSnapshot {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  effortEstimate: number | null;
  dependencies: string[];
  hasTestPlan: boolean;
}

const FIBONACCI = [1, 2, 3, 5, 8, 13];

export class INVESTValidator {
  check(snapshot: INVESTSnapshot): INVESTResult {
    const failedCriteria: string[] = [];

    if (snapshot.dependencies.length > 3) {
      failedCriteria.push('Independent');
    }

    if (snapshot.effortEstimate !== null && !FIBONACCI.includes(snapshot.effortEstimate)) {
      failedCriteria.push('Negotiable');
    }

    if (!snapshot.description || snapshot.description.length < 20) {
      failedCriteria.push('Valuable');
    }

    if (snapshot.effortEstimate !== null && snapshot.effortEstimate > 13) {
      failedCriteria.push('Small');
    }

    if (snapshot.acceptanceCriteria.length === 0) {
      failedCriteria.push('Testable');
    }

    if (snapshot.effortEstimate === null) {
      failedCriteria.push('Estimable');
    }

    const score = Math.round(((6 - failedCriteria.length) / 6) * 100);

    return {
      score,
      failedCriteria,
      passed: failedCriteria.length === 0,
    };
  }
}
