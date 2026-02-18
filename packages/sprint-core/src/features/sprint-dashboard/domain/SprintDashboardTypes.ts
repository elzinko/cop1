export interface StoryCard {
  id: string;
  title: string;
  status: string;
  points: number;
  assignedAgent?: string;
}

export interface SprintMetrics {
  totalStories: number;
  completedStories: number;
  inProgressStories: number;
  blockedStories: number;
  totalPoints: number;
  completedPoints: number;
  completionPercentage: number;
}
