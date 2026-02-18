export interface VelocityProjection {
  avgVelocity: number;
  estimatedSprints: number;
  confidence: 'low' | 'medium' | 'high';
}

export class VelocityProjector {
  project(velocityHistory: number[], remainingPoints: number): VelocityProjection {
    const avgVelocity =
      velocityHistory.length > 0
        ? velocityHistory.reduce((sum, v) => sum + v, 0) / velocityHistory.length
        : 0;

    const estimatedSprints =
      avgVelocity > 0 ? Math.ceil(remainingPoints / avgVelocity) : Number.POSITIVE_INFINITY;

    let confidence: VelocityProjection['confidence'];
    if (velocityHistory.length < 3) {
      confidence = 'low';
    } else if (velocityHistory.length <= 5) {
      confidence = 'medium';
    } else {
      confidence = 'high';
    }

    return { avgVelocity, estimatedSprints, confidence };
  }
}
