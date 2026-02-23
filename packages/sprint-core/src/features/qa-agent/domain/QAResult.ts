export interface QACheckResult {
  testsPass: boolean;
  lintClean: boolean;
  testOutput?: string;
  lintOutput?: string;
}
