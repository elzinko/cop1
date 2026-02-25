export interface BMADCommandResult {
  success: boolean;
  output: string;
  tokensUsed?: number;
  durationMs: number;
  /** Hint from the adapter: true if the error is transient and worth retrying. */
  retryable?: boolean;
}

export interface BMADCommandPort {
  execute(command: string, context: Record<string, string>): Promise<BMADCommandResult>;
}
