import { EventBus } from '@cop1/shared-kernel';
import { RuleProposalService } from '@cop1/sprint-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunAlreadyActiveError } from '../../orchestrator/infrastructure/HttpOrchestratorAdapter.js';
import { HttpServer } from '../infrastructure/HttpServer.js';
import type { OrchestratorAdapterPort } from '../infrastructure/HttpServer.js';

describe('HttpServer', () => {
  let server: HttpServer;
  const TEST_PORT = 14242;

  beforeEach(() => {
    server = new HttpServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should start and listen on the given port', async () => {
    await server.start(TEST_PORT);
    expect(server.listening).toBe(true);
  });

  it('should respond to /health with JSON', async () => {
    await server.start(TEST_PORT);

    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/health`);
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      status: string;
      uptime: number;
      version: string;
      pid: number;
    };
    expect(data.status).toBe('ok');
    expect(data.version).toBe('0.1.0');
    expect(typeof data.uptime).toBe('number');
    expect(data.pid).toBe(process.pid);
  });

  it('should respond 404 to unknown routes', async () => {
    await server.start(TEST_PORT);

    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/unknown`);
    expect(res.status).toBe(404);
  });

  it('should stop cleanly', async () => {
    await server.start(TEST_PORT);
    expect(server.listening).toBe(true);
    await server.stop();
    expect(server.listening).toBe(false);
  });

  it('should handle stop when not started', async () => {
    await expect(server.stop()).resolves.toBeUndefined();
  });

  describe('Rule Proposals API', () => {
    let eventBus: EventBus;
    let ruleProposalService: RuleProposalService;

    beforeEach(() => {
      eventBus = new EventBus();
      ruleProposalService = new RuleProposalService(eventBus);
      server.setRuleProposalProvider(ruleProposalService);
    });

    afterEach(() => {
      eventBus.removeAllListeners();
    });

    it('should return empty array when no proposals exist', async () => {
      await server.start(TEST_PORT);

      const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/rules/proposals`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toEqual([]);
    });

    it('should return all proposals', async () => {
      ruleProposalService.submit({
        type: 'architecture',
        ruleId: 'RULE-001',
        description: 'Test rule',
        reason: 'Test reason',
        submittedBy: 'dev-agent',
      });
      await server.start(TEST_PORT);

      const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/rules/proposals`);
      expect(res.status).toBe(200);

      const data = (await res.json()) as Array<{ ruleId: string; status: string }>;
      expect(data).toHaveLength(1);
      expect(data[0]?.ruleId).toBe('RULE-001');
      expect(data[0]?.status).toBe('pending');
    });

    it('should update proposal status via PATCH', async () => {
      ruleProposalService.submit({
        type: 'architecture',
        ruleId: 'RULE-001',
        description: 'Test rule',
        reason: 'Test reason',
        submittedBy: 'dev-agent',
      });
      await server.start(TEST_PORT);

      const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/rules/proposals/RULE-001`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      expect(res.status).toBe(200);

      const data = (await res.json()) as { ruleId: string; status: string };
      expect(data.ruleId).toBe('RULE-001');
      expect(data.status).toBe('approved');
    });

    it('should return 404 for unknown proposal id on PATCH', async () => {
      await server.start(TEST_PORT);

      const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/rules/proposals/UNKNOWN`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      expect(res.status).toBe(404);
    });

    it('should return 400 for PATCH without status field', async () => {
      ruleProposalService.submit({
        type: 'architecture',
        ruleId: 'RULE-001',
        description: 'Test rule',
        reason: 'Test reason',
        submittedBy: 'dev-agent',
      });
      await server.start(TEST_PORT);

      const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/rules/proposals/RULE-001`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for PATCH with invalid status value', async () => {
      ruleProposalService.submit({
        type: 'architecture',
        ruleId: 'RULE-001',
        description: 'Test rule',
        reason: 'Test reason',
        submittedBy: 'dev-agent',
      });
      await server.start(TEST_PORT);

      const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/rules/proposals/RULE-001`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'garbage' }),
      });
      expect(res.status).toBe(400);

      const data = (await res.json()) as { error: string };
      expect(data.error).toContain('Invalid status');
    });

    it('should pass reason to updateStatus when rejecting', async () => {
      ruleProposalService.submit({
        type: 'architecture',
        ruleId: 'RULE-001',
        description: 'Test rule',
        reason: 'Test reason',
        submittedBy: 'dev-agent',
      });
      await server.start(TEST_PORT);

      const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/rules/proposals/RULE-001`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', reason: 'Not aligned with goals' }),
      });
      expect(res.status).toBe(200);

      const data = (await res.json()) as {
        ruleId: string;
        status: string;
        rejectionReason?: string;
      };
      expect(data.status).toBe('rejected');
      expect(data.rejectionReason).toBe('Not aligned with goals');
    });
  });

  it('should serve SSE events on /events', async () => {
    const eventBus = new EventBus();
    server.setEventBus(eventBus);
    await server.start(TEST_PORT);

    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/events`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream');

    // Read the initial :ok message
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      const { value } = await reader.read();
      const text = decoder.decode(value);
      expect(text).toContain(':ok');

      // Emit an event
      eventBus.emit('test.event', { data: 'hello' });

      // Read the SSE message
      const { value: value2 } = await reader.read();
      const text2 = decoder.decode(value2);
      expect(text2).toContain('data:');
      expect(text2).toContain('test.event');

      reader.cancel();
    }
  });

  it('setEventBus is idempotent: a re-call never double-wraps emit (F4)', async () => {
    const eventBus = new EventBus();
    server.setEventBus(eventBus);
    server.setEventBus(eventBus); // second call must be a no-op
    await server.start(TEST_PORT);

    const res = await fetch(`http://127.0.0.1:${TEST_PORT}/events`);
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    if (reader) {
      await reader.read(); // consume :ok

      eventBus.emit('test.event', { data: 'once' });

      const { value } = await reader.read();
      const text = decoder.decode(value);
      // Exactly one SSE frame for the single emit (no duplicate from double-wrap).
      const frames = text.split('\n\n').filter((f) => f.includes('test.event'));
      expect(frames).toHaveLength(1);

      reader.cancel();
    }
  });

  describe('Orchestrator API', () => {
    let adapter: OrchestratorAdapterPort & {
      startRun: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      adapter = {
        startRun: vi.fn(() => ({ runId: 'run-abc' })),
        stop: vi.fn(async () => {}),
      };
      server.setOrchestratorAdapter(adapter);
    });

    it('POST /api/orchestrator/run returns 200 { runId }', async () => {
      await server.start(TEST_PORT);

      const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/orchestrator/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epic: 'EA1', mode: 'normal' }),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as { runId: string };
      expect(data.runId).toBe('run-abc');
      expect(adapter.startRun).toHaveBeenCalledWith(
        expect.objectContaining({ epic: 'EA1', mode: 'normal' }),
      );
    });

    it('defaults mode to normal when omitted', async () => {
      await server.start(TEST_PORT);

      const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/orchestrator/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epic: 'EA1' }),
      });
      expect(res.status).toBe(200);
      expect(adapter.startRun).toHaveBeenCalledWith(
        expect.objectContaining({ epic: 'EA1', mode: 'normal' }),
      );
    });

    it('returns 409 when a run is already active', async () => {
      adapter.startRun.mockImplementation(() => {
        throw new RunAlreadyActiveError();
      });
      await server.start(TEST_PORT);

      const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/orchestrator/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epic: 'EA1', mode: 'normal' }),
      });
      expect(res.status).toBe(409);
    });

    it('returns 400 when epic is missing', async () => {
      await server.start(TEST_PORT);

      const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/orchestrator/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'normal' }),
      });
      expect(res.status).toBe(400);
      expect(adapter.startRun).not.toHaveBeenCalled();
    });

    it('returns 400 for an invalid mode', async () => {
      await server.start(TEST_PORT);

      const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/orchestrator/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epic: 'EA1', mode: 'turbo' }),
      });
      expect(res.status).toBe(400);
      expect(adapter.startRun).not.toHaveBeenCalled();
    });

    it('forwards caps to the adapter', async () => {
      await server.start(TEST_PORT);

      await fetch(`http://127.0.0.1:${TEST_PORT}/api/orchestrator/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epic: 'EA1', mode: 'normal', caps: { maxTokens: 500 } }),
      });
      expect(adapter.startRun).toHaveBeenCalledWith(
        expect.objectContaining({ caps: { maxTokens: 500 } }),
      );
    });

    it('returns 400 for a non-numeric cap and does not start a run', async () => {
      await server.start(TEST_PORT);

      const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/orchestrator/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epic: 'EA1', mode: 'normal', caps: { maxTokens: 'abc' } }),
      });
      expect(res.status).toBe(400);
      expect(adapter.startRun).not.toHaveBeenCalled();
    });

    it('POST /api/orchestrator/stop calls adapter.stop and returns 200 { ok }', async () => {
      await server.start(TEST_PORT);

      const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/orchestrator/stop`, {
        method: 'POST',
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as { ok: boolean };
      expect(data.ok).toBe(true);
      expect(adapter.stop).toHaveBeenCalled();
    });

    it('streams an orchestrator event emitted on the daemon bus to an /events subscriber', async () => {
      const eventBus = new EventBus();
      server.setEventBus(eventBus);
      await server.start(TEST_PORT);

      const res = await fetch(`http://127.0.0.1:${TEST_PORT}/events`);
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        await reader.read(); // :ok

        eventBus.emit('orchestrator.command.started', { command: '/dev', runId: 'run-abc' });

        const { value } = await reader.read();
        const text = decoder.decode(value);
        expect(text).toContain('orchestrator.command.started');
        expect(text).toContain('run-abc');

        reader.cancel();
      }
    });
  });
});
