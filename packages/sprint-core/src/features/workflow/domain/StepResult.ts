export interface StepResult {
  status: 'ok' | 'failed' | 'blocked';
  error?: Error;
}
