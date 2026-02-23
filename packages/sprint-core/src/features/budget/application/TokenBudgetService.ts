import type { EventBus } from '@cop1/shared-kernel';
import type { BudgetStatus } from '../domain/BudgetStatus.js';
import type { TokenConsumption } from '../domain/TokenConsumption.js';
import type { BudgetStorePort, BudgetData } from '../domain/ports/BudgetStorePort.js';

/** Payload shape emitted by ClaudeCliAdapter on llm.call.completed. */
interface LlmCallCompletedPayload {
  model: string;
  agentType: string;
  promptLength: number;
  responseLength: number;
  durationMs: number;
  tokenCount: number;
}

const DEFAULT_MAX_TOKENS = 1_000_000;

/** Service that tracks token consumption per BMAD command, per agent, and per sprint day. */
export class TokenBudgetService {
  private totalConsumed = 0;
  private readonly breakdownByCommand: Record<string, number> = {};
  private readonly breakdownByAgent: Record<string, number> = {};
  private readonly events: TokenConsumption[] = [];
  private currentDate: string;
  private readonly maxTokens: number;

  constructor(
    private readonly eventBus: EventBus,
    private readonly store: BudgetStorePort,
    options?: { maxTokens?: number; currentDate?: string },
  ) {
    this.maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.currentDate = options?.currentDate ?? TokenBudgetService.todayString();
    this.restoreFromStore();
    this.eventBus.on('llm.call.completed', (payload: unknown) => this.handleLlmCallCompleted(payload));
  }

  /** Return current budget consumption status. */
  getBudgetStatus(): BudgetStatus {
    const remaining = Math.max(0, this.maxTokens - this.totalConsumed);
    const percentage = this.maxTokens > 0 ? (this.totalConsumed / this.maxTokens) * 100 : 0;
    return {
      consumed: this.totalConsumed,
      remaining,
      percentage: Math.round(percentage * 100) / 100,
      breakdownByCommand: { ...this.breakdownByCommand },
      breakdownByAgent: { ...this.breakdownByAgent },
    };
  }

  private handleLlmCallCompleted(payload: unknown): void {
    const data = payload as LlmCallCompletedPayload;
    const tokens = data.tokenCount ?? 0;
    if (tokens <= 0) return;

    const today = TokenBudgetService.todayString();
    if (today !== this.currentDate) {
      this.resetForNewDay(today);
    }

    const commandType = data.model ?? 'unknown';
    const agentType = data.agentType ?? 'unknown';

    this.totalConsumed += tokens;
    this.breakdownByCommand[commandType] = (this.breakdownByCommand[commandType] ?? 0) + tokens;
    this.breakdownByAgent[agentType] = (this.breakdownByAgent[agentType] ?? 0) + tokens;

    const consumption: TokenConsumption = {
      commandType,
      agentType,
      tokens,
      timestamp: new Date().toISOString(),
    };
    this.events.push(consumption);

    this.persist();
  }

  private restoreFromStore(): void {
    const data = this.store.load(this.currentDate);
    if (!data) return;

    this.totalConsumed = data.totalConsumed;
    Object.assign(this.breakdownByCommand, data.breakdownByCommand);
    Object.assign(this.breakdownByAgent, data.breakdownByAgent);
    this.events.push(...data.events);
  }

  private resetForNewDay(newDate: string): void {
    this.currentDate = newDate;
    this.totalConsumed = 0;
    for (const key of Object.keys(this.breakdownByCommand)) {
      delete this.breakdownByCommand[key];
    }
    for (const key of Object.keys(this.breakdownByAgent)) {
      delete this.breakdownByAgent[key];
    }
    this.events.length = 0;
    this.restoreFromStore();
  }

  private persist(): void {
    const data: BudgetData = {
      date: this.currentDate,
      totalConsumed: this.totalConsumed,
      breakdownByCommand: { ...this.breakdownByCommand },
      breakdownByAgent: { ...this.breakdownByAgent },
      events: [...this.events],
    };
    try {
      this.store.save(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[TokenBudgetService] Persist failed: ${message}`);
    }
  }

  private static todayString(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
