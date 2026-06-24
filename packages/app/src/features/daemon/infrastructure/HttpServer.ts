import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import type { EventBus } from '@cop1/shared-kernel';
import type { OrchestratorMode } from '../../orchestrator/application/OrchestratorService.js';
import { COP1_VERSION, type HealthInfo } from '../domain/DaemonState.js';
import type { AuthCheckResult } from './AuthChecker.js';

const MAX_BODY_SIZE = 10_240; // 10 KB
const VALID_STATUSES = ['pending', 'approved', 'rejected', 'debated'] as const;
type RuleProposalStatus = (typeof VALID_STATUSES)[number];

const VALID_RUN_MODES = ['normal', 'abort-on-escalation'] as const;
type RunLauncherMode = (typeof VALID_RUN_MODES)[number];

interface RunCaps {
  maxTokens?: number;
  deadlineMin?: number;
  maxUsdPerSession?: number;
}
const CAP_KEYS = ['maxTokens', 'deadlineMin', 'maxUsdPerSession'] as const;

/**
 * Validates the optional `caps` from a run request. The web form sends numbers,
 * but a raw POST could send anything — each provided cap must be a strictly
 * positive finite number (else 400) so a string never silently coerces inside
 * `RunBudget`. Absent/null caps are fine (env defaults apply).
 */
function parseCaps(raw: unknown): { ok: true; caps?: RunCaps } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true };
  if (typeof raw !== 'object') return { ok: false, error: 'caps must be an object' };
  const out: RunCaps = {};
  for (const key of CAP_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return { ok: false, error: `Invalid caps.${key}: must be a positive number` };
    }
    out[key] = value;
  }
  return { ok: true, caps: Object.keys(out).length > 0 ? out : undefined };
}

/** Minimal port the daemon's run launcher depends on (in-process adapter satisfies it). */
export interface OrchestratorAdapterPort {
  startRun(opts: { epic: string; mode: OrchestratorMode; caps?: RunCaps }): { runId: string };
  stop(): Promise<void>;
}

export type SprintStatusProvider = () => {
  stories: Record<string, string>;
  session: unknown;
} | null;

export interface RuleProposalRecord {
  ruleId: string;
  type: string;
  description: string;
  reason: string;
  submittedBy: string;
  submittedAt: string;
  status: RuleProposalStatus;
  rejectionReason?: string;
}

export interface RuleProposalProvider {
  getAll(): RuleProposalRecord[];
  updateStatus(ruleId: string, status: RuleProposalStatus, reason?: string): RuleProposalRecord;
}

export class HttpServer {
  private server: Server | null = null;
  private readonly startedAt: number = Date.now();
  private sseClients: Set<ServerResponse> = new Set();
  private sprintStatusProvider: SprintStatusProvider | null = null;
  private ruleProposalProvider: RuleProposalProvider | null = null;
  private authChecker: (() => Promise<AuthCheckResult>) | null = null;
  private orchestratorAdapter: OrchestratorAdapterPort | null = null;
  private eventBusWired = false;

  setSprintStatusProvider(provider: SprintStatusProvider): void {
    this.sprintStatusProvider = provider;
  }

  setRuleProposalProvider(provider: RuleProposalProvider): void {
    this.ruleProposalProvider = provider;
  }

  setAuthChecker(checker: () => Promise<AuthCheckResult>): void {
    this.authChecker = checker;
  }

  setOrchestratorAdapter(adapter: OrchestratorAdapterPort): void {
    this.orchestratorAdapter = adapter;
  }

  setEventBus(eventBus: EventBus): void {
    // F4: idempotent — wrapping `emit` more than once would broadcast each event
    // multiple times. Guard so a re-call (e.g. composition wiring) is a no-op.
    if (this.eventBusWired) return;
    this.eventBusWired = true;
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

    if (req.method === 'GET' && req.url === '/api/sprint/status') {
      const data = this.sprintStatusProvider?.() ?? null;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    if (req.method === 'GET' && req.url === '/api/rules/proposals') {
      const data = this.ruleProposalProvider?.getAll() ?? [];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    const patchMatch = req.url?.match(/^\/api\/rules\/proposals\/(.+)$/);
    if (patchMatch && req.method === 'PATCH') {
      const ruleId = patchMatch[1] ?? '';
      this.handleRuleProposalPatch(req, res, ruleId);
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

    if (req.method === 'GET' && req.url === '/api/auth/check') {
      void this.handleAuthCheck(res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/orchestrator/run') {
      this.handleOrchestratorRun(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/orchestrator/stop') {
      void this.handleOrchestratorStop(res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  }

  private handleOrchestratorRun(req: IncomingMessage, res: ServerResponse): void {
    this.readJsonBody(req, res, (parsed) => {
      const body = parsed as {
        epic?: string;
        mode?: string;
        caps?: { maxTokens?: number; deadlineMin?: number; maxUsdPerSession?: number };
      };
      if (!body.epic) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'epic field is required' }));
        return;
      }
      const mode = body.mode ?? 'normal';
      if (!(VALID_RUN_MODES as readonly string[]).includes(mode)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ error: `Invalid mode: must be one of ${VALID_RUN_MODES.join(', ')}` }),
        );
        return;
      }
      const capsParse = parseCaps(body.caps);
      if (!capsParse.ok) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: capsParse.error }));
        return;
      }
      if (!this.orchestratorAdapter) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'orchestrator adapter not configured' }));
        return;
      }
      try {
        const { runId } = this.orchestratorAdapter.startRun({
          epic: body.epic,
          mode: mode as RunLauncherMode,
          ...(capsParse.caps ? { caps: capsParse.caps } : {}),
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ runId }));
      } catch (error) {
        // Duck-typed to avoid a hard dependency on the adapter's error class.
        if (error instanceof Error && error.name === 'RunAlreadyActiveError') {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: message }));
      }
    });
  }

  private async handleOrchestratorStop(res: ServerResponse): Promise<void> {
    try {
      await this.orchestratorAdapter?.stop();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    }
  }

  /** Chunked JSON body parse with a MAX_BODY_SIZE guard (mirrors the PATCH path). */
  private readJsonBody(
    req: IncomingMessage,
    res: ServerResponse,
    onParsed: (parsed: unknown) => void,
  ): void {
    let body = '';
    let bodySize = 0;
    req.on('data', (chunk: Buffer) => {
      bodySize += chunk.length;
      if (bodySize > MAX_BODY_SIZE) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request body too large' }));
        req.destroy();
        return;
      }
      body += chunk.toString();
    });
    req.on('end', () => {
      if (bodySize > MAX_BODY_SIZE) return;
      try {
        onParsed(body ? JSON.parse(body) : {});
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: message }));
      }
    });
  }

  private async handleAuthCheck(res: ServerResponse): Promise<void> {
    const result: AuthCheckResult = this.authChecker
      ? await this.authChecker()
      : {
          ok: false,
          model: null,
          error: 'auth checker not configured',
          availability: 'unavailable',
        };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }

  private handleRuleProposalPatch(req: IncomingMessage, res: ServerResponse, ruleId: string): void {
    let body = '';
    let bodySize = 0;
    req.on('data', (chunk: Buffer) => {
      bodySize += chunk.length;
      if (bodySize > MAX_BODY_SIZE) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request body too large' }));
        req.destroy();
        return;
      }
      body += chunk.toString();
    });
    req.on('end', () => {
      if (bodySize > MAX_BODY_SIZE) return;
      try {
        const parsed = JSON.parse(body) as { status?: string; reason?: string };
        if (!parsed.status) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'status field is required' }));
          return;
        }

        if (!(VALID_STATUSES as readonly string[]).includes(parsed.status)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: `Invalid status: must be one of ${VALID_STATUSES.join(', ')}`,
            }),
          );
          return;
        }

        const updated = this.ruleProposalProvider?.updateStatus(
          ruleId,
          parsed.status as RuleProposalStatus,
          parsed.reason,
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(updated));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('not found')) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: message }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: message }));
        }
      }
    });
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
