export const BlocageType = {
  TIMEOUT: 'timeout',
  AMBIGUITY: 'ambiguity',
  MISSING_DEPENDENCY: 'missing-dependency',
  MISSING_ACCESS: 'missing-access',
  TECHNICAL: 'technical',
} as const;

export type BlocageTypeValue = (typeof BlocageType)[keyof typeof BlocageType];

export const BlocageStatus = {
  OPEN: 'open',
  RESOLVED: 'resolved',
} as const;

export type BlocageStatusValue = (typeof BlocageStatus)[keyof typeof BlocageStatus];

export interface BlocageData {
  id: string;
  storyId: string;
  type: BlocageTypeValue;
  reason: string;
  declaredAt: string;
  status: BlocageStatusValue;
  resolvedAt?: string;
  response?: string;
}

export const BlocageEvent = {
  STORY_BLOCKED: 'story.blocked',
  STORY_UNBLOCKED: 'story.unblocked',
} as const;
