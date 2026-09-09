import { afterEach, expect, it, vi } from "vitest";
import { createGeoDataSource } from "./source.ts";

const request = { regionId: "test", origin: { latitude: 0, longitude: 0 }, radiusMeters: 300 };
afterEach(() => vi.useRealTimers());

it("orders queued work by priority/FIFO and promotes without duplicating", async () => {
  vi.useFakeTimers();
  const starts: string[] = [];
  const source = createGeoDataSource(async (r) => { starts.push(r.regionId); return { elements: [] }; }, { minIntervalMs: 100 });
  const signal = new AbortController().signal;
  const jobs = [source.acquire({ ...request, regionId: "active" }), source.acquire({ ...request, regionId: "last" }, { signal }), source.acquire({ ...request, regionId: "p1" }, { priority: 1 }), source.acquire({ ...request, regionId: "p0" }, { priority: 0 })];
  source.promote?.(signal, 0);
  await vi.runAllTimersAsync();
  await Promise.all(jobs);
  expect(starts).toEqual(["active", "last", "p0", "p1"]);
  expect(vi.getTimerCount()).toBe(0);
});

it("bounds queue and cancels queued and non-cooperative active jobs", async () => {
  vi.useFakeTimers();
  const active = new AbortController();
  const queued = new AbortController();
  let calls = 0;
  const source = createGeoDataSource(() => { calls++; return new Promise(() => {}); }, { maxQueued: 1 });
  const a = source.acquire(request, { signal: active.signal }).catch((e) => e);
  const b = source.acquire(request, { signal: queued.signal }).catch((e) => e);
  await expect(source.acquire(request)).rejects.toMatchObject({ code: "queue-full" });
  queued.abort();
  active.abort();
  expect(await a).toMatchObject({ code: "aborted" });
  expect(await b).toMatchObject({ code: "aborted" });
  await vi.runAllTimersAsync();
  expect(calls).toBeLessThanOrEqual(1);
  expect(vi.getTimerCount()).toBe(0);
});

it("queue deadline is independent of the active budget", async () => {
  vi.useFakeTimers();
  const source = createGeoDataSource(() => new Promise(() => {}), { timeoutMs: 100, queueTimeoutMs: 30 });
  const a = source.acquire(request).catch((e) => e);
  const b = source.acquire(request).catch((e) => e);
  await vi.advanceTimersByTimeAsync(30);
  expect(await b).toMatchObject({ code: "queue-timeout" });
  await vi.advanceTimersByTimeAsync(70);
  expect(await a).toMatchObject({ code: "timeout" });
  expect(vi.getTimerCount()).toBe(0);
});

it("pre-abort never invokes loader and failures free the queue", async () => {
  const controller = new AbortController(); controller.abort();
  let calls = 0;
  const source = createGeoDataSource(async () => { if (++calls === 1) throw new Error("failed"); return { elements: [] }; });
  await expect(source.acquire(request, { signal: controller.signal })).rejects.toMatchObject({ code: "aborted" });
  await expect(source.acquire(request)).rejects.toThrow();
  await expect(source.acquire(request)).resolves.toEqual({ elements: [] });
  expect(calls).toBe(2);
});
