import { type Server, createServer } from 'node:http';
import { COP1_VERSION, type HealthInfo } from '../domain/DaemonState.js';

export class HttpServer {
  private server: Server | null = null;
  private readonly startedAt: number = Date.now();

  start(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        if (req.method === 'GET' && req.url === '/health') {
          const health: HealthInfo = {
            status: 'ok',
            uptime: Math.floor((Date.now() - this.startedAt) / 1000),
            version: COP1_VERSION,
            pid: process.pid,
          };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(health));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not_found' }));
      });

      this.server.on('error', reject);
      this.server.listen(port, '127.0.0.1', () => {
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close(() => {
        this.server = null;
        resolve();
      });
    });
  }

  get listening(): boolean {
    return this.server?.listening ?? false;
  }
}
