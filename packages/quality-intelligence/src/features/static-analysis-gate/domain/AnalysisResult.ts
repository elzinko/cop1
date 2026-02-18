export interface Violation {
  rule: string;
  file: string;
  line?: number;
  message: string;
}

export interface AnalysisResult {
  passed: boolean;
  violations: Violation[];
}
