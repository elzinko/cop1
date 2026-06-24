import { describe, expect, it, vi } from 'vitest';
import { EventBus } from './EventBus.js';
import { TaggingEventBus } from './TaggingEventBus.js';

describe('TaggingEventBus', () => {
  it('forwards a tagged object payload to the sink with the runId', () => {
    const sink = new EventBus();
    const received: unknown[] = [];
    sink.on('orchestrator.run.started', (p) => received.push(p));

    const bus = new TaggingEventBus(sink, 'run-123');
    bus.emit('orchestrator.run.started', { epicId: 'EA1' });

    expect(received).toEqual([{ epicId: 'EA1', runId: 'run-123' }]);
  });

  it('also fires local listeners registered on the tagging bus itself', () => {
    const sink = new EventBus();
    const local = vi.fn();

    const bus = new TaggingEventBus(sink, 'run-123');
    bus.on('session.workflow.completed', local);
    bus.emit('session.workflow.completed', { tokensUsed: 100 });

    expect(local).toHaveBeenCalledWith({ tokensUsed: 100, runId: 'run-123' });
  });

  it('wraps a non-object payload under { value, runId }', () => {
    const sink = new EventBus();
    const received: unknown[] = [];
    sink.on('orchestrator.note', (p) => received.push(p));

    const bus = new TaggingEventBus(sink, 'run-123');
    bus.emit('orchestrator.note', 'hello');

    expect(received).toEqual([{ value: 'hello', runId: 'run-123' }]);
  });

  it('wraps an array payload under { value, runId } (arrays are not spread)', () => {
    const sink = new EventBus();
    const received: unknown[] = [];
    sink.on('orchestrator.list', (p) => received.push(p));

    const bus = new TaggingEventBus(sink, 'run-123');
    bus.emit('orchestrator.list', [1, 2, 3]);

    expect(received).toEqual([{ value: [1, 2, 3], runId: 'run-123' }]);
  });
});
