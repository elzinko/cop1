import { BMADCommandStep } from './BMADCommandStep.js';

export class BMADQAStep extends BMADCommandStep {
  readonly name = 'bmad-qa';
  protected readonly command = '/bmad-bmm-qa-automate';
  protected readonly errorPrefix = 'BMAD QA validation failed';
}
