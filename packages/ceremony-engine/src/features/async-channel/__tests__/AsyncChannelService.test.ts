import { describe, expect, it } from 'vitest';
import { AsyncChannelService } from '../application/AsyncChannelService.js';

describe('AsyncChannelService', () => {
  it('should submit a response and return it', () => {
    const service = new AsyncChannelService();

    const response = service.submitResponse('ceremony-1', 'DevAgent', 'I agree with the plan');

    expect(response.ceremonyId).toBe('ceremony-1');
    expect(response.agentName).toBe('DevAgent');
    expect(response.position).toBe('I agree with the plan');
    expect(response.submittedAt).toBeTruthy();
  });

  it('should retrieve all responses for a ceremony', () => {
    const service = new AsyncChannelService();
    service.submitResponse('ceremony-1', 'Agent-A', 'Position A');
    service.submitResponse('ceremony-1', 'Agent-B', 'Position B');

    const responses = service.getResponses('ceremony-1');

    expect(responses).toHaveLength(2);
    expect(responses[0]?.agentName).toBe('Agent-A');
    expect(responses[1]?.agentName).toBe('Agent-B');
  });

  it('should keep responses separate across ceremonies', () => {
    const service = new AsyncChannelService();
    service.submitResponse('ceremony-1', 'Agent-A', 'Position A');
    service.submitResponse('ceremony-2', 'Agent-B', 'Position B');

    expect(service.getResponses('ceremony-1')).toHaveLength(1);
    expect(service.getResponses('ceremony-2')).toHaveLength(1);
    expect(service.getResponses('ceremony-1')[0]?.agentName).toBe('Agent-A');
  });

  it('should return empty array for unknown ceremony', () => {
    const service = new AsyncChannelService();

    const responses = service.getResponses('unknown');

    expect(responses).toHaveLength(0);
  });
});
