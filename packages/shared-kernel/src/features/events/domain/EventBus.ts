import { EventEmitter } from 'node:events';

export class EventBus {
  private readonly emitter = new EventEmitter();

  emit(eventType: string, payload: unknown): void {
    this.emitter.emit(eventType, payload);
  }

  on(eventType: string, handler: (payload: unknown) => void): void {
    this.emitter.on(eventType, handler);
  }

  off(eventType: string, handler: (payload: unknown) => void): void {
    this.emitter.off(eventType, handler);
  }

  removeAllListeners(eventType?: string): void {
    this.emitter.removeAllListeners(eventType);
  }
}
