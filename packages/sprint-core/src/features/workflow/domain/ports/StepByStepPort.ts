export type StepByStepMode = 'none' | 'intra' | 'inter' | 'both';

export interface StepByStepPort {
  setMode(mode: StepByStepMode): void;
  getMode(): StepByStepMode;
  isPaused(): boolean;
  awaitApproval(context: { phase: 'intra' | 'inter'; label?: string }): Promise<
    'continue' | 'skip' | 'abort'
  >;
}
