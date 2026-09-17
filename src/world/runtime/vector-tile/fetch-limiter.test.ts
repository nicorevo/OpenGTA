import { describe, expect, it } from "vitest";
import { FetchLimiter } from "./fetch-limiter.ts";

describe("FetchLimiter bounded concurrency", () => {
  it("never runs more than the configured works at the same time", async () => {
    const limiter = new FetchLimiter(2);
    const signal = new AbortController().signal;
    let active = 0;
    let peak = 0;
    const work = (name: string, holdMs: number) => {
      active += 1; peak = Math.max(peak, active);
      return new Promise<string>((resolve) => setTimeout(() => { active -= 1; resolve(name); }, holdMs));
    };
    const results = await Promise.all([
      limiter.run(() => work("one", 20), signal),
      limiter.run(() => work("two", 20), signal),
      limiter.run(() => work("three", 5), signal),
      limiter.run(() => work("four", 5), signal),
    ]);
    expect(results).toEqual(["one", "two", "three", "four"]);
    expect(peak).toBeLessThanOrEqual(2);
    expect(active).toBe(0);
  });

  it("admits waiters in FIFO order as slots free", async () => {
    const limiter = new FetchLimiter(1);
    const signal = new AbortController().signal;
    const order: string[] = [];
    let releaseFirst!: () => void;
    const first = limiter.run(() => new Promise<string>((resolve) => { order.push("first"); releaseFirst = () => resolve("first"); }), signal);
    const second = limiter.run(() => { order.push("second"); return Promise.resolve("second"); }, signal);
    const third = limiter.run(() => { order.push("third"); return Promise.resolve("third"); }, signal);
    // Only "first" runs; the others queue in request order.
    expect(order).toEqual(["first"]);
    releaseFirst();
    await expect(first).resolves.toBe("first");
    await expect(Promise.all([second, third])).resolves.toEqual(["second", "third"]);
    expect(order).toEqual(["first", "second", "third"]);
  });

  it("rejects a queued waiter on abort without holding its slot", async () => {
    const limiter = new FetchLimiter(1);
    let releaseFirst!: () => void;
    const first = limiter.run(
      () => new Promise<void>((resolve) => { releaseFirst = resolve; }),
      new AbortController().signal,
    );
    const controller = new AbortController();
    const queued = limiter.run(() => Promise.resolve("never"), controller.signal);
    controller.abort();
    await expect(queued).rejects.toMatchObject({ code: "aborted" });
    // The aborted waiter must not consume the freed slot.
    let ranAfterAbort = false;
    const next = limiter.run(() => { ranAfterAbort = true; return Promise.resolve("next"); }, new AbortController().signal);
    releaseFirst();
    await first;
    await expect(next).resolves.toBe("next");
    expect(ranAfterAbort).toBe(true);
    expect(limiter.activeCount).toBe(0);
  });

  it("rejects an already-aborted signal before running", async () => {
    const limiter = new FetchLimiter(1);
    let ran = false;
    const controller = new AbortController();
    controller.abort();
    await expect(limiter.run(() => { ran = true; return Promise.resolve("x"); }, controller.signal)).rejects.toMatchObject({ code: "aborted" });
    expect(ran).toBe(false);
  });

  it("rejects an invalid limit", () => {
    expect(() => new FetchLimiter(0)).toThrow(RangeError);
    expect(() => new FetchLimiter(-1)).toThrow(RangeError);
  });
});
