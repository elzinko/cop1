import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus } from '@cop1/shared-kernel';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DaemonService } from '../application/DaemonService.js';
import { PidFileManager } from '../infrastructure/PidFileManager.js';

describe('DaemonService', () => {
  let testDir: string;
  let daemon: DaemonService;
  const TEST_PORT = 14243;

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `cop1-daemon-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(testDir, { recursive: true });
    daemon = new DaemonService({ port: TEST_PORT, projectPath: testDir });
  });

  afterEach(async () => {
    await daemon.stop();
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should start and create PID file', async () => {
    await daemon.start();

    const pidManager = new PidFileManager(testDir);
    const pid = pidManager.read();
    expect(pid).toBe(process.pid);
  });

  it('should respond to health check after start', async () => {
    await daemon.start();

    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/health`);
    expect(res.status).toBe(200);

    const data = (await res.json()) as { status: string };
    expect(data.status).toBe('ok');
  });

  it('should clean up PID file on stop', async () => {
    await daemon.start();

    const pidManager = new PidFileManager(testDir);
    expect(pidManager.exists()).toBe(true);

    await daemon.stop();
    expect(pidManager.exists()).toBe(false);
  });

  it('should not throw when stopping without starting', async () => {
    await expect(daemon.stop()).resolves.toBeUndefined();
  });

  it('bridges its own EventBus to /events SSE (load-bearing wiring, B1)', async () => {
    const eventBus = new EventBus();
    const wired = new DaemonService({ port: 14244, projectPath: testDir, eventBus });
    try {
      await wired.start();

      const res = await fetch('http://127.0.0.1:14244/events');
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        await reader.read(); // :ok

        eventBus.emit('orchestrator.run.started', { epicId: 'EA1' });

        const { value } = await reader.read();
        const text = decoder.decode(value);
        expect(text).toContain('orchestrator.run.started');

        reader.cancel();
      }
    } finally {
      await wired.stop();
    }
  });
});
