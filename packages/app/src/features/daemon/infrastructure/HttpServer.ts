import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import type { EventBus } from '@cop1/shared-kernel';
import { COP1_VERSION, type HealthInfo } from '../domain/DaemonState.js';

export class HttpServer {
  private server: Server | null = null;
  private readonly startedAt: number = Date.now();
  private sseClients: Set<ServerResponse> = new Set();

  setEventBus(eventBus: EventBus): void {
    // Bridge all events to SSE clients
    const originalEmit = eventBus.emit.bind(eventBus);
    eventBus.emit = (eventType: string, payload: unknown) => {
      originalEmit(eventType, payload);
      this.broadcastSSE(eventType, payload);
    };
  }

  start(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', reject);
      this.server.listen(port, '127.0.0.1', () => {
        resolve();
      });
    });
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
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

    if (req.method === 'GET' && req.url === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(':ok\n\n');

      this.sseClients.add(res);
      req.on('close', () => {
        this.sseClients.delete(res);
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  }

  private broadcastSSE(eventType: string, payload: unknown): void {
    const data = JSON.stringify({
      eventType,
      timestamp: new Date().toISOString(),
      payload,
    });
    const message = `data: ${data}\n\n`;

    for (const client of this.sseClients) {
      try {
        client.write(message);
      } catch {
        this.sseClients.delete(client);
      }
    }
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all SSE clients
      for (const client of this.sseClients) {
        client.end();
      }
      this.sseClients.clear();

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
