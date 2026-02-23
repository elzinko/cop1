/** Current budget consumption status with breakdowns. */
export interface BudgetStatus {
  /** Total tokens consumed in the current budget period. */
  consumed: number;
  /** Remaining tokens before hitting the budget limit. */
  remaining: number;
  /** Percentage of budget consumed (0-100+). */
  percentage: number;
  /** Token breakdown by LLM model (e.g., 'claude-cli', 'ollama'). Named "command" for future compatibility when command type is added to event payload. */
  breakdownByCommand: Record<string, number>;
  /** Token breakdown by agent type. */
  breakdownByAgent: Record<string, number>;
}
