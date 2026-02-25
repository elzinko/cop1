import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProposalCard, type RuleProposal } from './ProposalCard.js';

const mockProposal: RuleProposal = {
  ruleId: 'RULE-001',
  type: 'architecture',
  description: 'Enforce hexagonal architecture',
  reason: 'Maintain clean boundaries',
  submittedBy: 'dev-agent',
  submittedAt: '2026-02-25T10:00:00.000Z',
  status: 'pending',
};

describe('ProposalCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('should display proposal metadata', () => {
    render(<ProposalCard proposal={mockProposal} onStatusChange={vi.fn()} />);

    expect(screen.getByText('RULE-001')).toBeDefined();
    expect(screen.getByText('architecture')).toBeDefined();
    expect(screen.getByText('Enforce hexagonal architecture')).toBeDefined();
    expect(screen.getByText('Maintain clean boundaries')).toBeDefined();
  });

  it('should display status badge', () => {
    render(<ProposalCard proposal={mockProposal} onStatusChange={vi.fn()} />);

    expect(screen.getByText('pending')).toBeDefined();
  });

  it('should show action buttons for pending proposals', () => {
    render(<ProposalCard proposal={mockProposal} onStatusChange={vi.fn()} />);

    expect(screen.getByText('Approve')).toBeDefined();
    expect(screen.getByText('Reject')).toBeDefined();
    expect(screen.getByText('Debate')).toBeDefined();
  });

  it('should not show action buttons for approved proposals', () => {
    const approvedProposal = { ...mockProposal, status: 'approved' as const };
    render(<ProposalCard proposal={approvedProposal} onStatusChange={vi.fn()} />);

    expect(screen.queryByText('Approve')).toBeNull();
    expect(screen.queryByText('Reject')).toBeNull();
    expect(screen.queryByText('Debate')).toBeNull();
  });

  it('should call onStatusChange with approved when Approve clicked', () => {
    const handler = vi.fn();
    render(<ProposalCard proposal={mockProposal} onStatusChange={handler} />);

    fireEvent.click(screen.getByText('Approve'));

    expect(handler).toHaveBeenCalledWith('RULE-001', 'approved');
  });

  it('should show reject reason input when Reject clicked', () => {
    render(<ProposalCard proposal={mockProposal} onStatusChange={vi.fn()} />);

    fireEvent.click(screen.getByText('Reject'));

    expect(screen.getByPlaceholderText('Reason for rejection...')).toBeDefined();
  });

  it('should call onStatusChange with debated when Debate clicked', () => {
    const handler = vi.fn();
    render(<ProposalCard proposal={mockProposal} onStatusChange={handler} />);

    fireEvent.click(screen.getByText('Debate'));

    expect(handler).toHaveBeenCalledWith('RULE-001', 'debated');
  });
});
