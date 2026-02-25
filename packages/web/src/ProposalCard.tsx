import { useState } from 'react';

export interface RuleProposal {
  ruleId: string;
  type: 'architecture' | 'team' | 'agent' | 'quality' | 'process';
  description: string;
  reason: string;
  submittedBy: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'debated';
}

interface ProposalCardProps {
  proposal: RuleProposal;
  onStatusChange: (ruleId: string, status: string, reason?: string) => void;
}

export function ProposalCard({ proposal, onStatusChange }: ProposalCardProps) {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleReject = () => {
    if (!showRejectInput) {
      setShowRejectInput(true);
      return;
    }
    onStatusChange(proposal.ruleId, 'rejected', rejectReason);
    setShowRejectInput(false);
    setRejectReason('');
  };

  const canAct = proposal.status === 'pending' || proposal.status === 'debated';

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">{proposal.ruleId}</h3>
        <span className={`badge ${proposal.status}`}>{proposal.status}</span>
      </div>
      <div className="card-content">
        <p className="proposal-type">
          <span className={`type-badge type-${proposal.type}`}>{proposal.type}</span>
        </p>
        <p>{proposal.description}</p>
        <p style={{ marginTop: '0.5rem' }}>
          <strong>Reason:</strong> {proposal.reason}
        </p>
      </div>
      <div className="card-footer">
        <span>By: {proposal.submittedBy}</span>
        <span>{new Date(proposal.submittedAt).toLocaleDateString()}</span>
      </div>
      {canAct && (
        <div className="proposal-actions">
          <button
            className="action-btn approve"
            onClick={() => onStatusChange(proposal.ruleId, 'approved')}
          >
            Approve
          </button>
          <button className="action-btn reject" onClick={handleReject}>
            Reject
          </button>
          <button
            className="action-btn debate"
            onClick={() => onStatusChange(proposal.ruleId, 'debated')}
          >
            Debate
          </button>
        </div>
      )}
      {showRejectInput && (
        <div className="reject-input">
          <input
            type="text"
            placeholder="Reason for rejection..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleReject();
            }}
          />
          <button className="action-btn reject" onClick={handleReject}>
            Confirm
          </button>
          <button
            className="action-btn cancel"
            onClick={() => {
              setShowRejectInput(false);
              setRejectReason('');
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
