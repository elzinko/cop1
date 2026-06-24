import { useEffect, useState } from 'react';

type Mode = 'normal' | 'abort-on-escalation';

interface SseFrame {
  eventType: string;
  payload: Record<string, unknown> & { runId?: string };
}

const TERMINAL_EVENTS = new Set(['orchestrator.run.completed', 'orchestrator.run.failed']);
const HEARTBEAT_IDLE_MS = 10_000;

/**
 * Mission-control view: launches an orchestrator run and streams its live status
 * over SSE (filtered by the returned runId). Shows the current story/command, a
 * token gauge vs cap, escalations loudly, a STOP button, and a heartbeat so a
 * silent command never looks frozen.
 */
export function OrchestratorRunView() {
  const [epic, setEpic] = useState('');
  const [mode, setMode] = useState<Mode>('normal');
  const [maxTokens, setMaxTokens] = useState('');
  const [deadlineMin, setDeadlineMin] = useState('');
  const [maxUsd, setMaxUsd] = useState('');

  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [story, setStory] = useState<string | null>(null);
  const [command, setCommand] = useState<string | null>(null);
  const [tokensUsed, setTokensUsed] = useState(0);
  const [tokenCap, setTokenCap] = useState<number | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const [terminal, setTerminal] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<number>(Date.now());
  const [silentMs, setSilentMs] = useState(0);

  // Raw run frames, retained as they arrive (even before the runId is known).
  // The rendered state is derived from these by filtering on the active runId,
  // so frames delivered just before the POST resolves are still attributed once
  // the runId is set — no early frame is ever dropped (the SSE has no replay).
  const [frames, setFrames] = useState<SseFrame[]>([]);

  // Live SSE subscription, opened ONCE on mount (independent of runId) and kept
  // open for the component's life. Because it is already live before the POST is
  // sent, the run.started / run.completed frames of even an instant run arrive
  // into the buffer and are matched retroactively once the runId is known.
  useEffect(() => {
    const source = new EventSource('/events');
    source.onmessage = (event: MessageEvent) => {
      let frame: SseFrame;
      try {
        frame = JSON.parse(event.data as string) as SseFrame;
      } catch {
        return;
      }
      setFrames((prev) => [...prev, frame]);
    };
    return () => {
      source.close();
    };
  }, []);

  // Derive the rendered run state from the buffered frames belonging to the
  // active runId. Re-runs when a new frame arrives or when the runId is set,
  // so frames buffered before the runId was known are still applied.
  useEffect(() => {
    if (!runId) return;
    const mine = frames.filter((frame) => (frame.payload ?? {}).runId === runId);
    if (mine.length === 0) return;

    let nextStory: string | null = null;
    let nextCommand: string | null = null;
    let nextTokens = 0;
    let nextAlert: string | null = null;
    let nextTerminal = false;

    for (const frame of mine) {
      const payload = frame.payload ?? {};
      switch (frame.eventType) {
        case 'orchestrator.story.started':
          nextStory = String(payload.storyKey ?? '');
          break;
        case 'orchestrator.command.started':
          nextCommand = String(payload.command ?? '');
          break;
        case 'session.workflow.completed': {
          const used = payload.tokensUsed;
          if (typeof used === 'number') nextTokens += used;
          break;
        }
        case 'orchestrator.run.aborted':
          nextAlert = `Run interrompu : ${String(payload.reason ?? 'abort')}`;
          break;
        case 'orchestrator.run.failed':
          nextAlert = `Échec du run : ${String(payload.error ?? 'erreur inconnue')}`;
          break;
        default:
          break;
      }
      if (payload.escalated === true) nextAlert = 'Escalade superviseur détectée';
      if (TERMINAL_EVENTS.has(frame.eventType)) nextTerminal = true;
    }

    if (nextStory !== null) setStory(nextStory);
    if (nextCommand !== null) setCommand(nextCommand);
    setTokensUsed(nextTokens);
    if (nextAlert !== null) setAlert(nextAlert);
    if (nextTerminal) setTerminal(true);
    setLastEventAt(Date.now());
  }, [frames, runId]);

  // Heartbeat: surface a "silent for Ns" hint when no event has arrived recently,
  // so a long-running command doesn't look like a frozen screen.
  useEffect(() => {
    if (!runId || terminal) return;
    const interval = setInterval(() => {
      setSilentMs(Date.now() - lastEventAt);
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, [runId, terminal, lastEventAt]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!epic) {
      setError('epic est requis');
      return;
    }
    const caps: Record<string, number> = {};
    if (maxTokens) caps.maxTokens = Number(maxTokens);
    if (deadlineMin) caps.deadlineMin = Number(deadlineMin);
    if (maxUsd) caps.maxUsdPerSession = Number(maxUsd);

    try {
      const res = await fetch('/api/orchestrator/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          epic,
          mode,
          ...(Object.keys(caps).length > 0 ? { caps } : {}),
        }),
      });
      if (res.status === 409) {
        setError('un run est déjà actif');
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `Échec (HTTP ${res.status})`);
        return;
      }
      const data = (await res.json()) as { runId: string };
      setTokenCap(caps.maxTokens ?? null);
      setTokensUsed(0);
      setStory(null);
      setCommand(null);
      setAlert(null);
      setTerminal(false);
      setLastEventAt(Date.now());
      setSilentMs(0);
      setRunId(data.runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const stop = async () => {
    try {
      await fetch('/api/orchestrator/stop', { method: 'POST' });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const running = runId !== null && !terminal;

  return (
    <div className="orchestrator-run">
      {error && (
        <div className="error">
          <strong>Erreur :</strong> {error}
        </div>
      )}

      {!running ? (
        <form onSubmit={submit}>
          <div>
            <label htmlFor="run-epic">Epic</label>
            <input
              id="run-epic"
              type="text"
              value={epic}
              onChange={(e) => setEpic(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="run-mode">Mode</label>
            <select
              id="run-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
            >
              <option value="normal">normal</option>
              <option value="abort-on-escalation">abort-on-escalation</option>
            </select>
          </div>
          <div>
            <label htmlFor="run-max-tokens">maxTokens</label>
            <input
              id="run-max-tokens"
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="run-deadline">deadlineMin</label>
            <input
              id="run-deadline"
              type="number"
              value={deadlineMin}
              onChange={(e) => setDeadlineMin(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="run-max-usd">maxUsd</label>
            <input
              id="run-max-usd"
              type="number"
              value={maxUsd}
              onChange={(e) => setMaxUsd(e.target.value)}
            />
          </div>
          <button type="submit">Lancer le run</button>
        </form>
      ) : (
        <div className="mission-control">
          {alert && (
            <div className="error" role="alert">
              <strong>⚠ {alert}</strong>
            </div>
          )}
          <p>
            <strong>Run :</strong> {runId}
          </p>
          <p>
            <strong>Story :</strong> {story ?? '—'}
          </p>
          <p>
            <strong>Commande :</strong> {command ?? '—'}
          </p>
          <p>
            <strong>Tokens :</strong> {tokensUsed}
            {tokenCap !== null ? ` / ${tokenCap}` : ''}
          </p>
          {tokenCap !== null && (
            <progress value={tokensUsed} max={tokenCap}>
              {tokensUsed} / {tokenCap}
            </progress>
          )}
          {silentMs > HEARTBEAT_IDLE_MS && (
            <p className="loading">
              en cours… (silencieux depuis {Math.floor(silentMs / 1000)}s)
            </p>
          )}
          <button type="button" onClick={stop}>
            STOP
          </button>
        </div>
      )}

      {terminal && (
        <div>
          <p className="loading">Run terminé.</p>
          {alert && (
            <div className="error" role="alert">
              <strong>⚠ {alert}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
