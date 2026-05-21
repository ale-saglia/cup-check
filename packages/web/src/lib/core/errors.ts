import type { MessageKey } from '../../i18n/i18n.svelte.js';

export class LocalizedError extends Error {
  constructor(
    readonly key: MessageKey,
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
