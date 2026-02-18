import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EventBus } from '@cop1/shared-kernel';
import type { AlertPayload } from '../domain/AlertPayload.js';

export class AsyncNotificationService {
  private counter = 0;

  constructor(private readonly eventBus: EventBus) {}

  notify(alertsDir: string, alert: AlertPayload): void {
    if (!existsSync(alertsDir)) {
      mkdirSync(alertsDir, { recursive: true });
    }

    const filename = `${Date.now()}-${this.counter++}.json`;
    writeFileSync(join(alertsDir, filename), JSON.stringify(alert, null, 2), 'utf-8');
    this.eventBus.emit('alert.created', alert);
  }

  getAlerts(alertsDir: string): AlertPayload[] {
    if (!existsSync(alertsDir)) {
      return [];
    }

    const files = readdirSync(alertsDir).filter((f) => f.endsWith('.json'));
    const alerts: AlertPayload[] = [];

    for (const file of files) {
      const content = readFileSync(join(alertsDir, file), 'utf-8');
      alerts.push(JSON.parse(content) as AlertPayload);
    }

    return alerts;
  }

  criticalBlocageAlert(storyId: string, blocageType: string): AlertPayload {
    return {
      type: 'blocage',
      storyId,
      message: `Critical blocage detected: ${blocageType} on story ${storyId}`,
      severity: 'high',
      createdAt: new Date().toISOString(),
    };
  }
}
