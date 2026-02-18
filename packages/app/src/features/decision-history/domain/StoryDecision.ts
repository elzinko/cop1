export interface StoryDecision {
  storyId: string;
  question: string;
  context: string;
  status: string;
  answer?: string;
  asked_at: string;
}
