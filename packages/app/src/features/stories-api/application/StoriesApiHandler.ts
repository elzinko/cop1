import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SprintStatusPort } from '../../orchestrator/domain/SprintStatusPort.js';

export class StoriesApiHandler {
  constructor(private readonly statusReader: SprintStatusPort) {}

  handle(req: IncomingMessage, res: ServerResponse): boolean {
    const urlMatch = req.url?.match(/^\/api\/stories\/([^/]+)$/);
    if (!urlMatch) return false;

    const storyId = urlMatch[1] ?? '';

    if (req.method === 'PUT') {
      return this.handlePut(storyId, res);
    }

    if (req.method === 'GET') {
      return this.handleGet(storyId, res);
    }

    return false;
  }

  private handlePut(storyId: string, res: ServerResponse): boolean {
    const status = this.statusReader.getStoryStatus(storyId);

    if (status === 'in-progress') {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'story_locked', reason: 'in-progress' }));
      return true;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return true;
  }

  private handleGet(storyId: string, res: ServerResponse): boolean {
    const status = this.statusReader.getStoryStatus(storyId);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ storyId, status: status ?? 'unknown' }));
    return true;
  }
}
