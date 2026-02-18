export const StoryStatus = {
  BACKLOG: 'backlog',
  READY: 'ready',
  IN_PROGRESS: 'in-progress',
  REVIEW: 'review',
  DONE: 'done',
} as const;

export type StoryStatusValue = (typeof StoryStatus)[keyof typeof StoryStatus];

const VALID_TRANSITIONS: Record<string, string[]> = {
  backlog: ['ready'],
  ready: ['in-progress'],
  'in-progress': ['review'],
  review: ['done', 'in-progress'],
  done: [],
};

export function isValidTransition(from: StoryStatusValue, to: StoryStatusValue): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}
