import type { TokenConsumption } from '../TokenConsumption.js';

/** Persisted budget data for a single day. */
export interface BudgetData {
  date: string;
  totalConsumed: number;
  breakdownByCommand: Record<string, number>;
  breakdownByAgent: Record<string, number>;
  events: TokenConsumption[];
}

/** Port for persisting and loading daily budget data. */
export interface BudgetStorePort {
  /** Load budget data for the given date. Returns undefined if no data exists. */
  load(date: string): BudgetData | undefined;
  /** Save budget data for the given date. */
  save(data: BudgetData): void;
}
