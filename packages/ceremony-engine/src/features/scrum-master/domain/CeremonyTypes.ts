export const CeremonyType = {
  PLANNING: 'planning',
  RETROSPECTIVE: 'retrospective',
  REVIEW: 'review',
  DAILY: 'daily',
} as const;

export type CeremonyTypeValue = (typeof CeremonyType)[keyof typeof CeremonyType];

export interface CeremonyReport {
  ceremonyType: CeremonyTypeValue;
  startedAt: string;
  completedAt: string;
  participants: string[];
  summary: string;
  decisions: string[];
}
