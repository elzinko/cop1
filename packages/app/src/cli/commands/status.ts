import { PidFileManager } from '../../features/daemon/infrastructure/PidFileManager.js';

export function statusCommand(): void {
  const projectPath = process.cwd();
  const pidManager = new PidFileManager(projectPath);

  const pid = pidManager.read();
  if (pid === null) {
    console.log('stopped');
    return;
  }

  if (!pidManager.isProcessAlive(pid)) {
    pidManager.delete();
    console.log('stopped (stale PID file removed)');
    return;
  }

  console.log(`running (pid: ${pid})`);
}
