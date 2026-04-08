import { EventBus } from '@cop1/shared-kernel';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenBudgetService } from '../application/TokenBudgetService.js';
import type { BudgetData, BudgetStorePort } from '../domain/ports/BudgetStorePort.js';

function createMockStore(): BudgetStorePort & { saved: BudgetData | undefined } {
  return {
    saved: undefined,
    load: vi.fn(() => undefined),
    save: vi.fn(function (this: { saved: BudgetData | undefined }, data: BudgetData) {
      this.saved = data;
    }),
  };
}

function emitLlmCall(
  eventBus: EventBus,
  overrides: Partial<{
    model: string;
    agentType: string;
    tokenCount: number;
  }> = {},
): void {
  eventBus.emit('llm.call.completed', {
    model: overrides.model ?? 'claude-cli',
    agentType: overrides.agentType ?? 'bmad',
    promptLength: 100,
    responseLength: 200,
    durationMs: 1000,
    tokenCount: overrides.tokenCount ?? 5000,
  });
}

describe('TokenBudgetService', () => {
  let eventBus: EventBus;
  let store: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    eventBus = new EventBus();
    store = createMockStore();
  });

  it('should accumulate tokens from llm.call.completed events', () => {
    new TokenBudgetService(eventBus, store, { currentDate: '2026-02-23' });

    emitLlmCall(eventBus, { tokenCount: 5000 });

    const status = store.saved;
    expect(status).toBeDefined();
    expect(status!.totalConsumed).toBe(5000);
  });

  it('should break down tokens by command type and agent type', () => {
    const service = new TokenBudgetService(eventBus, store, { currentDate: '2026-02-23' });

    emitLlmCall(eventBus, { model: 'claude-cli', agentType: 'bmad-dev', tokenCount: 3000 });
    emitLlmCall(eventBus, { model: 'claude-cli', agentType: 'bmad-reviewer', tokenCount: 2000 });
    emitLlmCall(eventBus, { model: 'ollama', agentType: 'bmad-dev', tokenCount: 1000 });

    const status = service.getBudgetStatus();
    expect(status.consumed).toBe(6000);
    expect(status.breakdownByCommand).toEqual({
      'claude-cli': 5000,
      ollama: 1000,
    });
    expect(status.breakdownByAgent).toEqual({
      'bmad-dev': 4000,
      'bmad-reviewer': 2000,
    });
  });

  it('should return correct consumed/remaining/percentage from getBudgetStatus', () => {
    const service = new TokenBudgetService(eventBus, store, {
      maxTokens: 100_000,
      currentDate: '2026-02-23',
    });

    emitLlmCall(eventBus, { tokenCount: 25000 });

    const status = service.getBudgetStatus();
    expect(status.consumed).toBe(25000);
    expect(status.remaining).toBe(75000);
    expect(status.percentage).toBe(25);
  });

  it('should persist state after each event', () => {
    new TokenBudgetService(eventBus, store, { currentDate: '2026-02-23' });

    emitLlmCall(eventBus, { tokenCount: 1000 });
    expect(store.save).toHaveBeenCalledTimes(1);

    emitLlmCall(eventBus, { tokenCount: 2000 });
    expect(store.save).toHaveBeenCalledTimes(2);
    expect(store.saved!.totalConsumed).toBe(3000);
  });

  it('should restore state from store on startup', () => {
    const existingData: BudgetData = {
      date: '2026-02-23',
      totalConsumed: 10000,
      breakdownByCommand: { 'claude-cli': 10000 },
      breakdownByAgent: { bmad: 10000 },
      events: [
        {
          commandType: 'claude-cli',
          agentType: 'bmad',
          tokens: 10000,
          timestamp: '2026-02-23T10:00:00Z',
        },
      ],
    };
    (store.load as ReturnType<typeof vi.fn>).mockReturnValue(existingData);

    const service = new TokenBudgetService(eventBus, store, {
      currentDate: '2026-02-23',
      maxTokens: 50000,
    });

    const status = service.getBudgetStatus();
    expect(status.consumed).toBe(10000);
    expect(status.remaining).toBe(40000);
    expect(status.percentage).toBe(20);
  });

  it('should ignore events with zero or negative token count', () => {
    const service = new TokenBudgetService(eventBus, store, { currentDate: '2026-02-23' });

    emitLlmCall(eventBus, { tokenCount: 0 });
    emitLlmCall(eventBus, { tokenCount: -100 });

    const status = service.getBudgetStatus();
    expect(status.consumed).toBe(0);
    expect(store.save).not.toHaveBeenCalled();
  });

  it('should use default maxTokens of 1_000_000', () => {
    const service = new TokenBudgetService(eventBus, store, { currentDate: '2026-02-23' });

    emitLlmCall(eventBus, { tokenCount: 500_000 });

    const status = service.getBudgetStatus();
    expect(status.remaining).toBe(500_000);
    expect(status.percentage).toBe(50);
  });

  it('should not crash when persist fails', () => {
    (store.save as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Disk full');
    });
    const service = new TokenBudgetService(eventBus, store, { currentDate: '2026-02-23' });

    expect(() => emitLlmCall(eventBus, { tokenCount: 5000 })).not.toThrow();

    // In-memory state should still be updated even if persist fails
    const status = service.getBudgetStatus();
    expect(status.consumed).toBe(5000);
  });

  it('should dynamically update maxTokens via updateMaxTokens()', () => {
    const service = new TokenBudgetService(eventBus, store, {
      maxTokens: 100_000,
      currentDate: '2026-02-23',
    });

    emitLlmCall(eventBus, { tokenCount: 60_000 });
    expect(service.getBudgetStatus().remaining).toBe(40_000);
    expect(service.getBudgetStatus().percentage).toBe(60);

    // Simulate config hot-reload: increase budget
    service.updateMaxTokens(200_000);
    expect(service.getBudgetStatus().remaining).toBe(140_000);
    expect(service.getBudgetStatus().percentage).toBe(30);
  });

  it('should reject invalid values in updateMaxTokens()', () => {
    const service = new TokenBudgetService(eventBus, store, {
      maxTokens: 100_000,
      currentDate: '2026-02-23',
    });

    expect(() => service.updateMaxTokens(0)).toThrow('maxTokens must be a positive integer');
    expect(() => service.updateMaxTokens(-1)).toThrow('maxTokens must be a positive integer');
    expect(() => service.updateMaxTokens(1.5)).toThrow('maxTokens must be a positive integer');
    expect(() => service.updateMaxTokens(Number.NaN)).toThrow(
      'maxTokens must be a positive integer',
    );

    // Original value should be unchanged after rejected updates
    expect(service.getBudgetStatus().remaining).toBe(100_000);
  });

  it('should reset budget on new day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-23T14:00:00Z'));

    const service = new TokenBudgetService(eventBus, store);

    emitLlmCall(eventBus, { tokenCount: 10000 });
    expect(service.getBudgetStatus().consumed).toBe(10000);

    // Advance to next day
    vi.setSystemTime(new Date('2026-02-24T09:00:00Z'));

    emitLlmCall(eventBus, { tokenCount: 3000 });

    const status = service.getBudgetStatus();
    expect(status.consumed).toBe(3000);

    vi.useRealTimers();
  });
});
