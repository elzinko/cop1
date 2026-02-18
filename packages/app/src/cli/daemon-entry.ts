import { parseArgs } from 'node:util';
import { DaemonService } from '../features/daemon/application/DaemonService.js';
import { DEFAULT_PORT } from '../features/daemon/domain/DaemonState.js';

const { values } = parseArgs({
  options: {
    port: { type: 'string', short: 'p', default: String(DEFAULT_PORT) },
  },
});

const port = Number.parseInt(values.port ?? String(DEFAULT_PORT), 10);
const projectPath = process.env.COP1_PROJECT_PATH ?? process.cwd();

const daemon = new DaemonService({ port, projectPath });

await daemon.start();
console.log(`cop1 daemon listening on port ${port} (pid: ${process.pid})`);
