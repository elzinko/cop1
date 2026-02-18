export interface TimeEstimate {
  estimatedRemainingMinutes: number;
  deadline: string;
  atRisk: boolean;
}

export class TimeEstimator {
  estimate(
    storiesRemaining: number,
    averageMinutesPerStory: number,
    sessionDeadline: Date,
    now: Date = new Date(),
  ): TimeEstimate {
    const estimatedRemainingMinutes = storiesRemaining * averageMinutesPerStory;
    const remainingSessionMinutes = (sessionDeadline.getTime() - now.getTime()) / 60_000;

    return {
      estimatedRemainingMinutes: Math.round(estimatedRemainingMinutes),
      deadline: sessionDeadline.toISOString(),
      atRisk: estimatedRemainingMinutes > remainingSessionMinutes,
    };
  }
}
