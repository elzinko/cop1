export interface DimensionResult {
  name: string;
  passed: boolean;
  missing: string[];
}

export interface DORValidationResult {
  passed: boolean;
  dimensions: DimensionResult[];
}
