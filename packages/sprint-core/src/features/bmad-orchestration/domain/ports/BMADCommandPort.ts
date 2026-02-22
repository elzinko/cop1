export interface BMADCommandResult {
  success: boolean;
  output: string;
  tokensUsed?: number;
  durationMs: number;
}

export interface BMADCommandPort {
  execute(command: string, context: Record<string, string>): Promise<BMADCommandResult>;
}
