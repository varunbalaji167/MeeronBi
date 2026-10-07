export const MAX_ATTEMPTS = 5;

const BASE_DELAY_MS = 30_000; // 30s
const CAP_MS = 30 * 60_000; // 30m

/** Exponential backoff for a failed send, capped so a persistent failure doesn't push retries days out. */
export function nextAttemptDelayMs(attempts: number): number {
  const safeAttempts = Math.max(attempts, 1);
  const delay = BASE_DELAY_MS * 4 ** (safeAttempts - 1);
  return Math.min(delay, CAP_MS);
}
