export interface BacklogStory {
  id: string;
  title: string;
  status: string;
  points: number | null;
  acceptanceCriteria: string[];
}

export interface BacklogPort {
  getStories(): BacklogStory[];
}
