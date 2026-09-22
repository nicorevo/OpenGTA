import { describe, it, expect } from "vitest";
import { createTokenBucket } from "./rate-limit.ts";

describe("createTokenBucket (VPS-10, spec 82: service-side rate limiting)", () => {
  it("allows a burst up to the bucket capacity without waiting", async () => {
    const bucket = createTokenBucket({ perMinute: 500 });
    const start = Date.now();
    for (let i = 0; i < 500; i += 1) {
      await bucket.acquire();
    }
    expect(Date.now() - start).toBeLessThan(50);
  });

  it("waits for refill once the burst is exhausted", async () => {
    // 60 per minute = one token per second.
    const bucket = createTokenBucket({ perMinute: 60 });
    for (let i = 0; i < 60; i += 1) {
      await bucket.acquire();
    }
    const start = Date.now();
    await bucket.acquire(); // 61st token: must wait ~1s
    expect(Date.now() - start).toBeGreaterThanOrEqual(900);
  });

  it("uses the injected clock for refill math", async () => {
    let now = 1_000_000;
    const bucket = createTokenBucket({ perMinute: 60, now: () => now });
    for (let i = 0; i < 60; i += 1) {
      await bucket.acquire();
    }
    // No wall time passes for the bucket itself; advance the logical clock.
    now += 61_000;
    const start = Date.now();
    await bucket.acquire();
    // The wait was scheduled at the logical deadline, already in the past:
    // it resolves on the first timer tick, not a second later.
    expect(Date.now() - start).toBeLessThan(900);
  });
});
