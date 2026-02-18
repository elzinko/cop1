import type { ReviewResult, ReviewerPort } from '@cop1/sprint-core';
import type { LLMGateway } from '../application/LLMGateway.js';

export class LLMReviewer implements ReviewerPort {
  constructor(private readonly gateway: LLMGateway) {}

  async review(qualityReport: string): Promise<ReviewResult> {
    const stream = this.gateway.completeForAgent('reviewer', qualityReport);
    let response = '';
    for await (const chunk of stream) {
      response += chunk.text;
    }
    return this.parseResponse(response);
  }

  private parseResponse(response: string): ReviewResult {
    const lower = response.toLowerCase();

    if (lower.includes('request-changes') || lower.includes('request changes')) {
      const comments = this.extractComments(response);
      return {
        verdict: 'request-changes',
        comments: comments.length > 0 ? comments : ['Changes requested by reviewer'],
      };
    }

    if (lower.includes('approve')) {
      return {
        verdict: 'approve',
        comments: this.extractComments(response),
      };
    }

    // Default: approve with warning when no clear verdict
    return {
      verdict: 'approve',
      comments: ['LLM response did not contain clear verdict'],
    };
  }

  private extractComments(response: string): string[] {
    const comments: string[] = [];
    const lines = response.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        comments.push(trimmed.slice(2).trim());
      }
    }
    return comments;
  }
}
