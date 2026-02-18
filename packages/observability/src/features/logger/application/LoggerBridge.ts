import type { EventBus } from '@cop1/shared-kernel';
import type { StructuredLogger } from './StructuredLogger.js';

const TRACKED_EVENTS = [
  'story.workflow.started',
  'story.workflow.completed',
  'story.workflow.failed',
  'story.step.started',
  'story.step.completed',
  'resource.snapshot',
  'config.reloaded',
];

export class LoggerBridge {
  constructor(
    private readonly eventBus: EventBus,
    private readonly logger: StructuredLogger,
  ) {}

  start(): void {
    for (const eventType of TRACKED_EVENTS) {
      this.eventBus.on(eventType, (payload) => {
        this.logger.event(eventType, payload as Record<string, unknown>);
      });
    }
  }
}
