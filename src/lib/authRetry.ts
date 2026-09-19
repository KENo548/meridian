/**
 * Bounded retry policy for cold-start-sensitive auth operations.
 *
 * Pure module: no DOM, no fetch, no timers of its own. Sleep and clock
 * are injectable so the schedule is unit-testable with a virtual clock.
 *
 * Scope: login only. Signup, password recovery, and session restore keep
 * their existing single-attempt behavior.
 */

export const LOGIN_MAX_ATTEMPTS = 4;

export const LOGIN_RETRY_DELAYS_MS: readonly number[] = [
  8000, 15000, 25000,
];

const RETRYABLE_PATTERNS: readonly RegExp[] = [
  /__COLD_START__/,
  /still starting up/i,
  /waking/i,
  /try again later/i,
  /database unavailable/i,
  /temporarily unavailable/i,
  /service unavailable/i,
  /bad gateway/i,
  /gateway timeout/i,
  /\(50[234]\)/,
  /failed to fetch/i,
  /networkerror/i,
  /network request failed/i,
  /load failed/i,
];

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return String(error);
  } catch {
    return '';
  }
}

/**
 * Retryable only on explicitly transient conditions: client-side aborts
 * (cold-start timeouts) and classified temporary service/database
 * responses. Default-deny: definitive credential, validation, conflict,
 * and unknown errors are never retried.
 */
export function isRetryableAuthError(error: unknown): boolean {
  if (
    typeof DOMException !== 'undefined' &&
    error instanceof DOMException &&
    error.name === 'AbortError'
  ) {
    return true;
  }

  return RETRYABLE_PATTERNS.some((pattern) =>
    pattern.test(messageOf(error)),
  );
}

export interface AuthRetryCallbacks {
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  onRetry?: (info: {
    attempt: number;
    maxAttempts: number;
  }) => void;
}

export interface AuthRetryOutcome<T> {
  value: T;
  attempts: number;
  elapsedMs: number;
}

export class AuthRetryExhaustedError extends Error {
  readonly attempts: number;

  constructor(
    message: string,
    attempts: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'AuthRetryExhaustedError';
    this.attempts = attempts;
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function runWithAuthRetry<T>(
  operation: () => Promise<T>,
  options?: AuthRetryCallbacks & {
    maxAttempts?: number;
    delaysMs?: readonly number[];
  },
): Promise<AuthRetryOutcome<T>> {
  const maxAttempts = options?.maxAttempts ?? LOGIN_MAX_ATTEMPTS;
  const delays = options?.delaysMs ?? LOGIN_RETRY_DELAYS_MS;
  const sleep = options?.sleep ?? defaultSleep;
  const now = options?.now ?? Date.now;
  const started = now();
  let attempt = 0;

  for (;;) {
    attempt += 1;

    try {
      const value = await operation();
      return { value, attempts: attempt, elapsedMs: now() - started };
    } catch (error) {
      const retryable = isRetryableAuthError(error);
      const retriesUsed = attempt - 1;
      const budgetRemains =
        attempt < maxAttempts && retriesUsed < delays.length;

      if (!retryable || !budgetRemains) {
        if (attempt > 1 && retryable) {
          throw new AuthRetryExhaustedError(
            'Auth retry budget exhausted',
            attempt,
            { cause: error },
          );
        }
        throw error;
      }

      options?.onRetry?.({ attempt, maxAttempts });
      await sleep(delays[retriesUsed] ?? 0);
    }
  }
}
