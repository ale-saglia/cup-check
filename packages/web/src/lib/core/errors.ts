export class LocalizedError extends Error {
  constructor(
    readonly key: string,
    readonly values: Record<string, string | number> = {},
    options: ErrorOptions = {},
  ) {
    super(key, options);
    this.name = 'LocalizedError';
  }
}

export function isLocalizedError(error: unknown): error is LocalizedError {
  return error instanceof LocalizedError;
}
