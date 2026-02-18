import { PidFileManager } from '../../features/daemon/infrastructure/PidFileManager.js';

export async function stopCommand(): Promise<void> {
  const projectPath = process.cwd();
  const pidManager = new PidFileManager(projectPath);

  const pid = pidManager.read();
  if (pid === null) {
    console.log('cop1 is not running');
    return;
  }

  if (!pidManager.isProcessAlive(pid)) {
    console.log('cop1 is not running (stale PID file removed)');
    pidManager.delete();
    return;
  }

  console.log(`Stopping cop1 daemon (pid: ${pid})...`);
  process.kill(pid, 'SIGTERM');

  // Wait for PID file to be removed (daemon cleans up on exit)
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (!pidManager.exists()) {
      console.log('cop1 stopped');
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  console.error('Daemon did not stop within 10s');
  process.exit(1);
}
