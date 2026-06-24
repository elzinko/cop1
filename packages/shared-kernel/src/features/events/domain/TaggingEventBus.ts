import { EventBus } from './EventBus.js';

/**
 * EventBus decorator that tags every emitted payload with a `runId` and forwards
 * it to a long-lived `sink` bus (the daemon's SSE-bridged bus), while ALSO
 * delivering to its own local listeners.
 *
 * The run (OrchestratorService + runner) emits on this bus; `on`/`off`
 * (inherited) register on this instance's OWN emitter, so per-run listeners
 * (budget crediting, claude-status, interaction collector) die with the run and
 * never leak onto the daemon's bus. The `sink` bus has its `emit` SSE-wrapped by
 * `HttpServer.setEventBus`, so every event reaches `/events` tagged with `runId`.
 */
export class TaggingEventBus extends EventBus {
  constructor(
    private readonly sink: EventBus,
    private readonly runId: string,
  ) {
    super();
  }

  emit(eventType: string, payload: unknown): void {
    const tagged =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? { ...(payload as Record<string, unknown>), runId: this.runId }
        : { value: payload, runId: this.runId };
    super.emit(eventType, tagged); // local listeners (budget, claude-status, interaction collector)
    this.sink.emit(eventType, tagged); // daemon bus → SSE broadcast (already wrapped by setEventBus)
  }
}
