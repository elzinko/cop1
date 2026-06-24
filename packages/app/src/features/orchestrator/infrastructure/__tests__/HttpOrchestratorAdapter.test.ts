import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus } from '@cop1/shared-kernel';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { OrchestratorRunResult } from '../../application/OrchestratorService.js';
import {
  HttpOrchestratorAdapter,
  RunAlreadyActiveError,
  type RunFactory,
} from '../HttpOrchestratorAdapter.js';

const EMPTY_RESULT: OrchestratorRunResult = {
  epicId: 'EA1',
  storiesProcessed: [],
  escalated: false,
  aborted: false,
};

/** A fake run factory whose handle drives the test's emit script on the run bus. */
function fakeFactory(script: (bus: EventBus) => Promise<void> | void): RunFactory {
  return async (opts) => ({
    run: async () => {
      await script(opts.eventBus);
      return EMPTY_RESULT;
    },
  });
}

/** Wait until a predicate is true (poll), to handle the fire-and-forget run. */
async function until(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('timeout waiting for condition');
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe('HttpOrchestratorAdapter', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'http-orch-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('forwards run events to the sink tagged with the returned runId', async () => {
    const sink = new EventBus();
    const received: Array<{ type: string; runId: unknown }> = [];
    sink.on('orchestrator.run.started', (p) =>
      received.push({ type: 'started', runId: (p as { runId?: unknown }).runId }),
    );
    sink.on('orchestrator.run.completed', (p) =>
      received.push({ type: 'completed', runId: (p as { runId?: unknown }).runId }),
    );

    const adapter = new HttpOrchestratorAdapter(sink, dir, {
      runFactory: fakeFactory((bus) => {
        bus.emit('orchestrator.run.started', { epicId: 'EA1' });
        bus.emit('orchestrator.run.completed', { epicId: 'EA1' });
      }),
    });

    const { runId } = adapter.startRun({ epic: 'EA1', mode: 'normal' });
    expect(runId).toBeTruthy();

    await until(() => received.length === 2);
    expect(received).toEqual([
      { type: 'started', runId },
      { type: 'completed', runId },
    ]);
  });

  it('rejects a second startRun while a run is active', async () => {
    const sink = new EventBus();
    let release: () => void = () => {};
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });

    const adapter = new HttpOrchestratorAdapter(sink, dir, {
      runFactory: fakeFactory(async () => {
        await blocked; // keep the run active until we release it
      }),
    });

    adapter.startRun({ epic: 'EA1', mode: 'normal' });
    expect(adapter.isActive).toBe(true);
    expect(() => adapter.startRun({ epic: 'EA1', mode: 'normal' })).toThrow(RunAlreadyActiveError);

    release();
    await until(() => adapter.isActive === false);
  });

  it('clears the active flag after a terminal run and allows a new run', async () => {
    const sink = new EventBus();
    const adapter = new HttpOrchestratorAdapter(sink, dir, {
      runFactory: fakeFactory(() => {}),
    });

    adapter.startRun({ epic: 'EA1', mode: 'normal' });
    await until(() => adapter.isActive === false);

    // A new run is allowed now.
    expect(() => adapter.startRun({ epic: 'EA2', mode: 'normal' })).not.toThrow();
    await until(() => adapter.isActive === false);
  });

  it('purges a stale .cop1/abort file before building/running (AC-B6)', async () => {
    const sink = new EventBus();
    const abortPath = join(dir, '.cop1', 'abort');
    await mkdir(join(dir, '.cop1'), { recursive: true });
    await writeFile(abortPath, '', 'utf-8');
    expect(existsSync(abortPath)).toBe(true);

    let abortSeenAtRun: boolean | null = null;
    const adapter = new HttpOrchestratorAdapter(sink, dir, {
      runFactory: fakeFactory(() => {
        abortSeenAtRun = existsSync(abortPath);
      }),
    });

    adapter.startRun({ epic: 'EA1', mode: 'normal' });
    await until(() => abortSeenAtRun !== null);
    expect(abortSeenAtRun).toBe(false);
  });

  it('emits orchestrator.run.failed (tagged) when the factory/run throws', async () => {
    const sink = new EventBus();
    const failures: unknown[] = [];
    sink.on('orchestrator.run.failed', (p) => failures.push(p));

    const adapter = new HttpOrchestratorAdapter(sink, dir, {
      runFactory: fakeFactory(() => {
        throw new Error('kaboom');
      }),
    });

    const { runId } = adapter.startRun({ epic: 'EA1', mode: 'normal' });
    await until(() => failures.length === 1);
    expect(failures[0]).toMatchObject({ error: 'kaboom', runId });
    await until(() => adapter.isActive === false);
  });

  it('stop() writes .cop1/abort', async () => {
    const sink = new EventBus();
    const adapter = new HttpOrchestratorAdapter(sink, dir, {
      runFactory: fakeFactory(() => {}),
    });

    await adapter.stop();
    expect(existsSync(join(dir, '.cop1', 'abort'))).toBe(true);
  });
});
