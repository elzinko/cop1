import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrchestratorRunView } from './OrchestratorRunView.js';

interface FakeEventSource {
  onmessage: ((event: { data: string }) => void) | null;
  close: ReturnType<typeof vi.fn>;
}

let lastEventSource: FakeEventSource | null = null;

function stubEventSource(): void {
  vi.stubGlobal(
    'EventSource',
    vi.fn().mockImplementation(() => {
      const instance: FakeEventSource = { onmessage: null, close: vi.fn() };
      lastEventSource = instance;
      return instance;
    }),
  );
}

/** Push an SSE frame to the live EventSource (waits for the run to subscribe). */
async function pushSse(eventType: string, payload: Record<string, unknown>): Promise<void> {
  await waitFor(() => {
    expect(lastEventSource?.onmessage).toBeTruthy();
  });
  act(() => {
    lastEventSource?.onmessage?.({ data: JSON.stringify({ eventType, payload }) });
  });
}

describe('OrchestratorRunView', () => {
  beforeEach(() => {
    lastEventSource = null;
    stubEventSource();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ runId: 'r1' }) }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  async function startRun(): Promise<void> {
    fireEvent.change(screen.getByLabelText(/epic/i), { target: { value: 'EA1' } });
    fireEvent.click(screen.getByRole('button', { name: /lancer/i }));
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/orchestrator/run',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  }

  it('POSTs the run to /api/orchestrator/run with the epic and mode', async () => {
    render(<OrchestratorRunView />);
    await startRun();

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const [, init] = fetchMock.mock.calls.find((c) => c[0] === '/api/orchestrator/run') as [
      string,
      { body: string },
    ];
    const body = JSON.parse(init.body) as { epic: string; mode: string };
    expect(body.epic).toBe('EA1');
    expect(body.mode).toBe('normal');
  });

  it('renders the current command from a runId-tagged SSE event', async () => {
    render(<OrchestratorRunView />);
    await startRun();

    await pushSse('orchestrator.command.started', { command: '/bmad-bmm-dev-story', runId: 'r1' });

    expect(await screen.findByText(/bmad-bmm-dev-story/)).toBeTruthy();
  });

  it('ignores SSE events whose runId does not match the active run', async () => {
    render(<OrchestratorRunView />);
    await startRun();

    await pushSse('orchestrator.command.started', { command: '/other-run-cmd', runId: 'SOMEONE-ELSE' });

    expect(screen.queryByText(/other-run-cmd/)).toBeNull();
  });

  it('updates the token gauge from session.workflow.completed tokensUsed', async () => {
    render(<OrchestratorRunView />);
    await startRun();

    await pushSse('session.workflow.completed', { tokensUsed: 100, runId: 'r1' });

    expect(await screen.findByText(/100/)).toBeTruthy();
  });

  it('STOP posts to /api/orchestrator/stop', async () => {
    render(<OrchestratorRunView />);
    await startRun();

    fireEvent.click(await screen.findByRole('button', { name: /stop/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/orchestrator/stop',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('shows a loud banner when the run fails', async () => {
    render(<OrchestratorRunView />);
    await startRun();

    await pushSse('orchestrator.run.failed', { error: 'boom', runId: 'r1' });

    expect(await screen.findByText(/boom/)).toBeTruthy();
  });

  it('subscribes to SSE on mount, before a run is started', async () => {
    render(<OrchestratorRunView />);

    const EventSourceMock = globalThis.EventSource as unknown as ReturnType<typeof vi.fn>;
    expect(EventSourceMock).toHaveBeenCalledWith('/events');
    expect(lastEventSource).not.toBeNull();
  });

  it('does not drop the run.started/run.completed frames of an instant run (race)', async () => {
    render(<OrchestratorRunView />);
    await startRun();

    // Terminal frames arrive immediately, in the same tick the POST resolves —
    // the early frames must NOT be lost: the view must reach the terminal state.
    await pushSse('orchestrator.run.started', { runId: 'r1' });
    await pushSse('orchestrator.run.completed', { runId: 'r1' });

    expect(await screen.findByText(/run terminé/i)).toBeTruthy();
    // Form is re-enabled on terminal (the launch button is back).
    expect(screen.getByRole('button', { name: /lancer/i })).toBeTruthy();
  });

  it('shows "un run est déjà actif" on a 409 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ error: 'A run is already active' }),
      }),
    );
    render(<OrchestratorRunView />);
    fireEvent.change(screen.getByLabelText(/epic/i), { target: { value: 'EA1' } });
    fireEvent.click(screen.getByRole('button', { name: /lancer/i }));

    expect(await screen.findByText(/un run est déjà actif/i)).toBeTruthy();
  });
});
