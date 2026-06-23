import { useState } from 'react';

type Availability = 'ok' | 'degraded' | 'unavailable';

interface AuthStatus {
  ok: boolean;
  model: string | null;
  error?: string;
  /** Optional — older daemons may omit it; we fall back to `ok`/`unavailable`. */
  availability?: Availability;
}

/** Resolve a coarse availability, tolerating older daemons without the field. */
function resolveAvailability(status: AuthStatus): Availability {
  if (status.availability) return status.availability;
  return status.ok ? 'ok' : 'unavailable';
}

const RENDER: Record<Availability, { light: string; label: string }> = {
  ok: { light: '🟢', label: 'Connecté' },
  degraded: { light: '🟡', label: 'Claude temporairement indisponible (réessayer)' },
  unavailable: { light: '🔴', label: 'Non connecté' },
};

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
        availability: 'unavailable',
      });
    } finally {
      setLoading(false);
    }
  };

  const availability = status ? resolveAvailability(status) : null;

  return (
    <div className="auth-panel" style={{ padding: '1rem 0' }}>
      <button type="button" onClick={test} disabled={loading}>
        {loading ? 'Test…' : 'Tester la connexion'}
      </button>
      {status && availability && (
        <p style={{ marginTop: '1rem', fontSize: '1.1rem' }}>
          {RENDER[availability].light} {RENDER[availability].label}
          {availability === 'ok'
            ? ` — modèle : ${status.model ?? 'inconnu'}`
            : status.error
              ? ` — ${status.error}`
              : ''}
        </p>
      )}
    </div>
  );
}
