import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SidecarSyncService } from '../application/SidecarSyncService.js';
import type { RuleSet } from '../domain/RuleSet.js';
import type { RuleLoaderPort } from '../domain/ports/RuleLoaderPort.js';
import type { SidecarSyncPort } from '../domain/ports/SidecarSyncPort.js';

function createMockPort(): SidecarSyncPort {
  return {
    write: vi.fn(),
  };
}

function createMockLoader(ruleSet: RuleSet): RuleLoaderPort {
  return {
    load: vi.fn(() => ruleSet),
  };
}

const fullRuleSet: RuleSet = {
  global: [
    { id: 'G1', description: 'No force push to main', source: 'team-retro' },
    { id: 'G2', description: 'All PRs need review', source: 'team-retro' },
  ],
  scrum: [{ id: 'S1', description: 'Daily async standup required', source: 'sm-decision' }],
  architecture: [
    { id: 'A1', description: 'Hexagonal architecture mandatory', source: 'architect' },
    { id: 'A2', description: 'No direct DB access from domain', source: 'architect' },
  ],
  agents: {
    'dev-agent': [{ id: 'D1', description: 'Write tests before code', source: 'quality-review' }],
    'qa-agent': [{ id: 'Q1', description: 'Cover edge cases', source: 'quality-review' }],
  },
};

const emptyRuleSet: RuleSet = {
  global: [],
  scrum: [],
  architecture: [],
  agents: {},
};

describe('SidecarSyncService', () => {
  let port: SidecarSyncPort;
  let service: SidecarSyncService;

  describe('sync with full rules', () => {
    beforeEach(() => {
      port = createMockPort();
      const loader = createMockLoader(fullRuleSet);
      service = new SidecarSyncService(loader, port);
    });

    it('should write markdown to sidecar port', () => {
      service.sync();
      expect(port.write).toHaveBeenCalledTimes(1);
      const content = (port.write as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(content).toContain('# cop1 Governance Rules');
    });

    it('should format with organized section headings', () => {
      service.sync();
      const content = (port.write as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(content).toContain('## Global Rules');
      expect(content).toContain('## Scrum Rules');
      expect(content).toContain('## Architecture Rules');
      expect(content).toContain('## Agent Rules');
    });

    it('should format each rule as bullet point with id, description, and source', () => {
      service.sync();
      const content = (port.write as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(content).toContain('- **G1**: No force push to main (source: team-retro)');
      expect(content).toContain('- **A1**: Hexagonal architecture mandatory (source: architect)');
    });

    it('should include agent-specific subsections', () => {
      service.sync();
      const content = (port.write as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(content).toContain('### dev-agent');
      expect(content).toContain('- **D1**: Write tests before code (source: quality-review)');
      expect(content).toContain('### qa-agent');
      expect(content).toContain('- **Q1**: Cover edge cases (source: quality-review)');
    });

    it('should include last sync timestamp at top', () => {
      service.sync();
      const content = (port.write as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(content).toMatch(/^> Last synced: \d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('sync with empty rules', () => {
    beforeEach(() => {
      port = createMockPort();
      const loader = createMockLoader(emptyRuleSet);
      service = new SidecarSyncService(loader, port);
    });

    it('should generate valid markdown with no rules message', () => {
      service.sync();
      const content = (port.write as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
      expect(content).toContain('# cop1 Governance Rules');
      expect(content).toContain('No governance rules defined');
    });
  });

  describe('idempotency', () => {
    it('should produce identical output when called twice with same input', () => {
      const loader = createMockLoader(fullRuleSet);
      port = createMockPort();
      service = new SidecarSyncService(loader, port);

      service.sync();
      const firstOutput = (port.write as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;

      service.sync();
      const secondOutput = (port.write as ReturnType<typeof vi.fn>).mock.calls[1]?.[0] as string;

      // Remove timestamps for idempotency comparison (timestamps will differ)
      const stripTimestamp = (s: string) => s.replace(/^> Last synced: .*$/m, '');
      expect(stripTimestamp(firstOutput)).toBe(stripTimestamp(secondOutput));
    });

    it('should produce deterministic agent ordering', () => {
      const ruleSetWithManyAgents: RuleSet = {
        global: [],
        scrum: [],
        architecture: [],
        agents: {
          'zebra-agent': [{ id: 'Z1', description: 'Zebra rule', source: 'test' }],
          'alpha-agent': [{ id: 'A1', description: 'Alpha rule', source: 'test' }],
          'mid-agent': [{ id: 'M1', description: 'Mid rule', source: 'test' }],
        },
      };

      const loader = createMockLoader(ruleSetWithManyAgents);
      port = createMockPort();
      service = new SidecarSyncService(loader, port);

      service.sync();
      const content = (port.write as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;

      const alphaPos = content.indexOf('### alpha-agent');
      const midPos = content.indexOf('### mid-agent');
      const zebraPos = content.indexOf('### zebra-agent');

      expect(alphaPos).toBeLessThan(midPos);
      expect(midPos).toBeLessThan(zebraPos);
    });
  });
});
