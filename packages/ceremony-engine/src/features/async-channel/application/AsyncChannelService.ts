import type { AsyncResponse } from '../domain/AsyncChannelTypes.js';

export class AsyncChannelService {
  private readonly store = new Map<string, AsyncResponse[]>();

  submitResponse(ceremonyId: string, agentName: string, position: string): AsyncResponse {
    const response: AsyncResponse = {
      ceremonyId,
      agentName,
      position,
      submittedAt: new Date().toISOString(),
    };

    const existing = this.store.get(ceremonyId) ?? [];
    existing.push(response);
    this.store.set(ceremonyId, existing);

    return response;
  }

  getResponses(ceremonyId: string): AsyncResponse[] {
    return this.store.get(ceremonyId) ?? [];
  }
}
