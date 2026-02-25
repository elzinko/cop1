export class BudgetExhaustedError extends Error {
  constructor(
    public readonly consumed: number,
    public readonly limit: number,
  ) {
    super(`Token budget exhausted: ${consumed}/${limit} tokens consumed`);
    this.name = 'BudgetExhaustedError';
  }
}
