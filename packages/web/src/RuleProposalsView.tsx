import { useEffect, useState } from 'react';
import { ProposalCard, type RuleProposal } from './ProposalCard.js';

type TypeFilter = 'all' | 'architecture' | 'team' | 'agent' | 'quality' | 'process';

export function RuleProposalsView() {
  const [proposals, setProposals] = useState<RuleProposal[]>([]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProposals = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/rules/proposals');
      if (!response.ok) {
        throw new Error('Failed to fetch rule proposals');
      }
      const data = (await response.json()) as RuleProposal[];
      setProposals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  useEffect(() => {
    const eventSource = new EventSource('/events');

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data as string) as { eventType: string };
        if (
          parsed.eventType === 'rule.proposal.submitted' ||
          parsed.eventType === 'rule.applied' ||
          parsed.eventType === 'rule.rejected' ||
          parsed.eventType === 'rule.proposal.debated'
        ) {
          fetchProposals();
        }
      } catch {
        // Ignore non-JSON SSE messages
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const handleStatusChange = async (ruleId: string, status: string, reason?: string) => {
    try {
      const response = await fetch(`/api/rules/proposals/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason }),
      });
      if (!response.ok) {
        throw new Error('Failed to update proposal status');
      }
      const updated = (await response.json()) as RuleProposal;
      setProposals((prev) => prev.map((p) => (p.ruleId === updated.ruleId ? updated : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const filtered =
    typeFilter === 'all' ? proposals : proposals.filter((p) => p.type === typeFilter);

  const typeFilters: TypeFilter[] = ['all', 'architecture', 'team', 'agent', 'quality', 'process'];

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error) {
    return (
      <div className="error">
        <strong>Error:</strong> {error}
      </div>
    );
  }

  return (
    <div>
      <div className="type-filters">
        {typeFilters.map((type) => (
          <button
            key={type}
            className={`type-filter-btn ${typeFilter === type ? 'active' : ''}`}
            onClick={() => setTypeFilter(type)}
          >
            {type}
          </button>
        ))}
      </div>
      <div className="grid">
        {filtered.map((proposal) => (
          <ProposalCard
            key={proposal.ruleId}
            proposal={proposal}
            onStatusChange={handleStatusChange}
          />
        ))}
        {filtered.length === 0 && <p className="loading">No rule proposals yet</p>}
      </div>
    </div>
  );
}
