export interface PlanningDecision {
  sprintId: string;
  engagedStories: Array<{ id: string; title: string; points: number }>;
  totalPoints: number;
  capacity: number;
  decidedAt: string;
}
