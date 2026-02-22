import { BMADCommandStep } from './BMADCommandStep.js';

export class BMADDevStoryStep extends BMADCommandStep {
  readonly name = 'bmad-dev';
  protected readonly command = '/bmad-bmm-dev-story';
  protected readonly errorPrefix = 'BMAD dev-story failed';
}
