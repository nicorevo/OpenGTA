/**
 * Service-side token bucket (VPS-10, spec 82): the service is the only layer
 * that issues network calls, and it must respect the upstream limits
 * (Overpass is a public service, Mapillary free-plan quota). Pure timing
 * logic with an injectable clock; the wall clock is the default.
 *
 * Capacity = perMinute (a full burst), refill = one token per 60_000/perMinute
 * ms. `acquire()` resolves as soon as a token is available.
 */
export interface RateLimiter {
  acquire(): Promise<void>;
}

export interface TokenBucketOptions {
  /** Refill rate, tokens per minute (and burst capacity). */
  readonly perMinute: number;
  /** Injectable clock (tests); defaults to Date.now. */
  readonly now?: () => number;
}

export function createTokenBucket(options: TokenBucketOptions): RateLimiter {
  if (!Number.isFinite(options.perMinute) || options.perMinute <= 0) {
    throw new RangeError(`perMinute must be a positive finite number, got ${options.perMinute}`);
  }
  const now = options.now ?? Date.now;
  const capacity = options.perMinute;
  const refillMs = 60_000 / options.perMinute;

  let tokens = capacity;
  let updatedAt = now();

  const refill = (): void => {
    const current = now();
    const elapsed = current - updatedAt;
    if (elapsed > 0) {
      tokens = Math.min(capacity, tokens + elapsed / refillMs);
      updatedAt = current;
    }
  };

  return {
    async acquire(): Promise<void> {
      for (;;) {
        refill();
        if (tokens >= 1) {
          tokens -= 1;
          return;
        }
        const deficit = 1 - tokens;
        await new Promise<void>((resolve) => {
          setTimeout(resolve, Math.ceil(deficit * refillMs));
        });
      }
    },
  };
}
