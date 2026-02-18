import type { EventBus } from '@cop1/shared-kernel';
import type { ReviewAction } from '../domain/ReviewAction.js';

export class DeveloperReviewService {
  constructor(private readonly eventBus: EventBus) {}

  approve(suggestionId: string): ReviewAction {
    const action: ReviewAction = {
      suggestionId,
      action: 'approved',
      timestamp: new Date().toISOString(),
    };

    this.eventBus.emit('improvement.approved', action);
    return action;
  }

  reject(suggestionId: string, reason: string): ReviewAction {
    const action: ReviewAction = {
      suggestionId,
      action: 'rejected',
      reason,
      timestamp: new Date().toISOString(),
    };

    this.eventBus.emit('improvement.rejected', action);
    return action;
  }

  requestDebate(suggestionId: string): ReviewAction {
    const action: ReviewAction = {
      suggestionId,
      action: 'debate-requested',
      timestamp: new Date().toISOString(),
    };

    this.eventBus.emit('improvement.debate-requested', action);
    return action;
  }
}
