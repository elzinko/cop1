import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RuleProposalsView } from './RuleProposalsView.js';
import type { RuleProposal } from './ProposalCard.js';

const mockProposals: RuleProposal[] = [
  {
    ruleId: 'RULE-001',
    type: 'architecture',
    description: 'Enforce hexagonal architecture',
    reason: 'Maintain clean boundaries',
    submittedBy: 'dev-agent',
    submittedAt: '2026-02-25T10:00:00.000Z',
    status: 'pending',
  },
  {
    ruleId: 'RULE-002',
    type: 'quality',
    description: 'Require 80% coverage',
    reason: 'Improve reliability',
    submittedBy: 'qa-agent',
    submittedAt: '2026-02-25T11:00:00.000Z',
    status: 'approved',
  },
];

describe('RuleProposalsView', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockProposals),
      }),
    );

    vi.stubGlobal('EventSource', vi.fn().mockImplementation(() => ({
      onmessage: null,
      close: vi.fn(),
    })));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should display proposals after loading', async () => {
    render(<RuleProposalsView />);

    await waitFor(() => {
      expect(screen.getByText('RULE-001')).toBeDefined();
      expect(screen.getByText('RULE-002')).toBeDefined();
    });
  });

  it('should display type filter buttons', async () => {
    render(<RuleProposalsView />);

    await waitFor(() => {
      expect(screen.getByText('RULE-001')).toBeDefined();
    });

    const filterButtons = screen.getAllByRole('button');
    const filterTexts = filterButtons.map((b) => b.textContent);
    expect(filterTexts).toContain('all');
    expect(filterTexts).toContain('architecture');
    expect(filterTexts).toContain('quality');
  });

  it('should show empty message when no proposals', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    render(<RuleProposalsView />);

    await waitFor(() => {
      expect(screen.getByText('No rule proposals yet')).toBeDefined();
    });
  });

  it('should show error on fetch failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    render(<RuleProposalsView />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch rule proposals')).toBeDefined();
    });
  });

  it('should filter proposals by type when filter button clicked', async () => {
    render(<RuleProposalsView />);

    await waitFor(() => {
      expect(screen.getByText('RULE-001')).toBeDefined();
      expect(screen.getByText('RULE-002')).toBeDefined();
    });

    const filterButtons = screen.getAllByRole('button');
    const archButton = filterButtons.find((b) => b.textContent === 'architecture' && b.classList.contains('type-filter-btn'));
    expect(archButton).toBeDefined();
    fireEvent.click(archButton!);

    expect(screen.getByText('RULE-001')).toBeDefined();
    expect(screen.queryByText('RULE-002')).toBeNull();
  });

  it('should call PATCH endpoint when Approve is clicked', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProposals),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockProposals[0], status: 'approved' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    render(<RuleProposalsView />);

    await waitFor(() => {
      expect(screen.getByText('RULE-001')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Approve'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/rules/proposals/RULE-001', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved', reason: undefined }),
      });
    });
  });

  it('should re-fetch proposals when SSE event received', async () => {
    let sseHandler: ((event: { data: string }) => void) | null = null;
    vi.stubGlobal('EventSource', vi.fn().mockImplementation(() => {
      const instance = {
        onmessage: null as ((event: { data: string }) => void) | null,
        close: vi.fn(),
      };
      setTimeout(() => {
        sseHandler = instance.onmessage;
      }, 0);
      return instance;
    }));

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockProposals),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<RuleProposalsView />);

    await waitFor(() => {
      expect(screen.getByText('RULE-001')).toBeDefined();
    });

    const callCountBefore = fetchMock.mock.calls.length;

    // Simulate SSE event
    await waitFor(() => {
      expect(sseHandler).not.toBeNull();
    });
    sseHandler!({ data: JSON.stringify({ eventType: 'rule.proposal.submitted' }) });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callCountBefore);
    });
  });
});
