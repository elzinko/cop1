import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PORT } from '../../features/daemon/domain/DaemonState.js';
import { PidFileManager } from '../../features/daemon/infrastructure/PidFileManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function waitForHealth(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) return true;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

export async function startCommand(options: { port?: string }): Promise<void> {
  const port = options.port ? Number.parseInt(options.port, 10) : DEFAULT_PORT;
  const projectPath = process.cwd();
  const pidManager = new PidFileManager(projectPath);

  const existingPid = pidManager.read();
  if (existingPid !== null && pidManager.isProcessAlive(existingPid)) {
    console.error(`cop1 is already running (pid: ${existingPid})`);
    process.exit(1);
  }

  // Clean stale PID file
  if (existingPid !== null) {
    pidManager.delete();
  }

  const daemonEntry = join(__dirname, '..', 'daemon-entry.js');
  const child = spawn(process.execPath, [daemonEntry, '--port', String(port)], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, COP1_PROJECT_PATH: projectPath },
  });

  child.unref();

  if (!child.pid) {
    console.error('Failed to start daemon');
    process.exit(1);
  }

  console.log(`Starting cop1 daemon (pid: ${child.pid}, port: ${port})...`);

  const healthy = await waitForHealth(port, 30_000);
  if (!healthy) {
    console.error('Daemon failed to start within 30s');
    process.exit(1);
  }

  console.log(`cop1 started (pid: ${child.pid})`);
}
