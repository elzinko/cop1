import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthPanel } from './AuthPanel.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AuthPanel', () => {
  it('shows the model in green when the check is ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ json: async () => ({ ok: true, model: 'claude-test' }) })),
    );
    render(<AuthPanel />);
    fireEvent.click(screen.getByText('Tester la connexion'));
    expect(await screen.findByText(/claude-test/)).toBeTruthy();
  });

  it('shows the error in red when the check is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ json: async () => ({ ok: false, model: null, error: 'boom-401' }) })),
    );
    render(<AuthPanel />);
    fireEvent.click(screen.getByText('Tester la connexion'));
    expect(await screen.findByText(/boom-401/)).toBeTruthy();
  });
});
