import { DEFAULT_PORT } from '../../features/daemon/domain/DaemonState.js';

export async function healthCommand(options: { port?: string }): Promise<void> {
  const port = options.port ? Number.parseInt(options.port, 10) : DEFAULT_PORT;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    if (!res.ok) {
      console.error(`Health check failed: HTTP ${res.status}`);
      process.exit(1);
    }
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch {
    console.error('cop1 daemon is not reachable');
    process.exit(1);
  }
}
