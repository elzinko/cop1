export interface QualityGateResult {
  passed: boolean;
  gates: Array<{ name: string; passed: boolean; message?: string }>;
}

export interface QualityGatePort {
  runAll(context: { storyId: string; projectPath: string }): Promise<QualityGateResult>;
}
