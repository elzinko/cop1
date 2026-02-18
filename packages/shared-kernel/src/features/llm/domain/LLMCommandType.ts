export const LLMCommandType = {
  DEV: 'dev',
  REVIEW: 'review',
  CEREMONY: 'ceremony',
  QA: 'qa',
  PM: 'pm',
  DEFAULT: 'default',
} as const;

export type LLMCommandTypeValue = (typeof LLMCommandType)[keyof typeof LLMCommandType];
