import { BMADCommandStep } from './BMADCommandStep.js';

export class BMADReviewStep extends BMADCommandStep {
  readonly name = 'bmad-review';
  protected readonly command = '/bmad-bmm-code-review';
  protected readonly errorPrefix = 'BMAD code-review failed';
}
