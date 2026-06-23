import { useState } from 'react';

interface AuthStatus {
  ok: boolean;
  model: string | null;
  error?: string;
}

export function AuthPanel() {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const test = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/check');
      setStatus((await res.json()) as AuthStatus);
    } catch (err) {
      setStatus({
        ok: false,
        model: null,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-panel" style={{ padding: '1rem 0' }}>
      <button type="button" onClick={test} disabled={loading}>
        {loading ? 'Test…' : 'Tester la connexion'}
      </button>
      {status && (
        <p style={{ marginTop: '1rem', fontSize: '1.1rem' }}>
          {status.ok
            ? `🟢 Connecté — modèle : ${status.model ?? 'inconnu'}`
            : `🔴 Non connecté${status.error ? ` — ${status.error}` : ''}`}
        </p>
      )}
    </div>
  );
}
