export class ConfigValidationError extends Error {
  constructor(
    public readonly field: string,
    public readonly detail: string,
  ) {
    super(`Invalid config at "${field}": ${detail}`);
    this.name = 'ConfigValidationError';
  }
}
