import type { ConfigPort } from '@cop1/shared-kernel';
import { describe, expect, it } from 'vitest';
import { LLMGateway } from '../application/LLMGateway.js';
import { LLMRouter } from '../application/LLMRouter.js';
import type { LLMProvider } from '../domain/ports/LLMProvider.js';
import type { LLMChunk } from '../domain/types/LLMChunk.js';
import type { LLMRequest } from '../domain/types/LLMRequest.js';
import { LLMReviewer } from '../infrastructure/LLMReviewer.js';

const mockConfig: ConfigPort = {
  get: () => ({
    project: { name: 'test', path: '.' },
    daemon: { port: 4242 },
    sprint: { default_duration_hours: 2 },
    resources: {
      ram_budget_night_gb: 48,
      ram_budget_day_gb: 20,
      suspension_threshold_percent: 75,
      polling_interval_ms: 1000,
    },
    llm_routing: { dev: 'llama3.2', reviewer: 'llama3.2', default: 'llama3.2' },
    llm_fallback: { default: 'llama3.2' },
    git: { auto_merge: false },
    blocage_rules: {},
    schedule: { auto_start: [] },
  }),
};

function createGatewayWithResponse(response: string): LLMGateway {
  const provider: LLMProvider = {
    async *complete(_request: LLMRequest): AsyncIterable<LLMChunk> {
      yield { text: response, done: true };
    },
    async health() {
      return { available: true, models: ['llama3.2'] };
    },
  };
  return new LLMGateway(provider).withRouter(new LLMRouter(mockConfig));
}

describe('LLMReviewer', () => {
  it('should parse approve verdict', async () => {
    const response = 'I approve this code.\n- Clean structure\n- Good naming';
    const reviewer = new LLMReviewer(createGatewayWithResponse(response));

    const result = await reviewer.review('coverage: 85%');

    expect(result.verdict).toBe('approve');
    expect(result.comments).toContain('Clean structure');
    expect(result.comments).toContain('Good naming');
  });

  it('should parse request-changes verdict', async () => {
    const response = 'I request-changes on this code.\n- Missing error handling\n- No tests';
    const reviewer = new LLMReviewer(createGatewayWithResponse(response));

    const result = await reviewer.review('coverage: 20%');

    expect(result.verdict).toBe('request-changes');
    expect(result.comments).toContain('Missing error handling');
    expect(result.comments).toContain('No tests');
  });

  it('should parse "request changes" without hyphen', async () => {
    const response = 'I request changes.\n- Fix the bug';
    const reviewer = new LLMReviewer(createGatewayWithResponse(response));

    const result = await reviewer.review('report');

    expect(result.verdict).toBe('request-changes');
    expect(result.comments).toContain('Fix the bug');
  });

  it('should default to approve with warning for unclear response', async () => {
    const response = 'The code looks interesting but I have no strong opinion.';
    const reviewer = new LLMReviewer(createGatewayWithResponse(response));

    const result = await reviewer.review('report');

    expect(result.verdict).toBe('approve');
    expect(result.comments).toContain('LLM response did not contain clear verdict');
  });

  it('should provide default comment for request-changes without bullet points', async () => {
    const response = 'request-changes: this needs work';
    const reviewer = new LLMReviewer(createGatewayWithResponse(response));

    const result = await reviewer.review('report');

    expect(result.verdict).toBe('request-changes');
    expect(result.comments).toEqual(['Changes requested by reviewer']);
  });

  it('should extract comments with asterisk bullets', async () => {
    const response = 'I approve.\n* Well tested\n* Good coverage';
    const reviewer = new LLMReviewer(createGatewayWithResponse(response));

    const result = await reviewer.review('report');

    expect(result.verdict).toBe('approve');
    expect(result.comments).toContain('Well tested');
    expect(result.comments).toContain('Good coverage');
  });
});
