export interface GateResult {
  name: string;
  passed: boolean;
  details?: string;
}

export interface GatePort {
  name: string;
  check(context: { worktreePath: string }): GateResult;
}
