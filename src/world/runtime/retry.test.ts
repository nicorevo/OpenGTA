import { afterEach, expect, it, vi } from "vitest";
import { createOverpassGeoDataSource } from "./source.ts";
const request = { regionId: "test", origin: { latitude: 0, longitude: 0 }, radiusMeters: 300 };
afterEach(() => vi.useRealTimers());

it.each([null, "", "invalid", "-1", "0", "1", "3", "Thu, 01 Jan 1970 00:00:05 GMT"])("respects Retry-After %s and spacing across jobs", async (header) => {
  vi.useFakeTimers(); vi.setSystemTime(0);
  const starts: number[] = [];
  const source = createOverpassGeoDataSource(undefined, async () => {
    starts.push(Date.now());
    return { ok: starts.length > 1, status: starts.length === 1 ? 429 : 200, headers: new Headers(header === null ? {} : { "retry-after": header }), json: async () => ({ elements: [] }) };
  });
  const work = Promise.all([source.acquire(request), source.acquire(request)]);
  await vi.runAllTimersAsync(); await work;
  const retryAt = header === "3" ? 3000 : header?.includes("GMT") ? 5000 : 2000;
  expect(starts).toEqual([0, retryAt, retryAt + 2000]);
  expect(vi.getTimerCount()).toBe(0);
});

it("preserves provider cooldown beyond the active budget across subsequent jobs", async () => {
  vi.useFakeTimers(); vi.setSystemTime(0);
  const starts: number[] = [];
  const source = createOverpassGeoDataSource(undefined, async () => {
    starts.push(Date.now());
    return { ok: starts.length > 1, status: starts.length > 1 ? 200 : 503, headers: new Headers({ "retry-after": "60" }), json: async () => ({ elements: [] }) };
  });
  const first = source.acquire(request).catch((e) => e);
  await vi.advanceTimersByTimeAsync(0);
  expect(await first).toMatchObject({ code: "http", status: 503, retryAt: 60000 });
  const next = source.acquire(request);
  await vi.runAllTimersAsync(); await next;
  expect(starts).toEqual([0, 60000]);
  expect(vi.getTimerCount()).toBe(0);
});

it("aborts backoff without another attempt", async () => {
  vi.useFakeTimers();
  let calls = 0;
  const source = createOverpassGeoDataSource(undefined, async () => { calls++; return { ok: false, status: 500, headers: new Headers(), json: async () => ({}) }; });
  const controller = new AbortController();
  const result = source.acquire(request, { signal: controller.signal }).catch((e) => e);
  await vi.advanceTimersByTimeAsync(1); controller.abort();
  expect(await result).toMatchObject({ code: "aborted" });
  await vi.runAllTimersAsync();
  expect(calls).toBe(1); expect(vi.getTimerCount()).toBe(0);
});

it.each([400, 403, 429, 500, 503])("only retries transient status %s, with at most three attempts", async (status) => {
  vi.useFakeTimers(); vi.setSystemTime(0);
  const starts: number[] = [];
  const source = createOverpassGeoDataSource(undefined, async () => {
    starts.push(Date.now());
    return { ok: false, status, headers: new Headers(), json: async () => ({}) };
  });
  const result = source.acquire(request).catch((e) => e);
  await vi.runAllTimersAsync();
  expect(await result).toMatchObject({ code: "http", status });
  expect(starts).toEqual(status < 429 ? [0] : [0, 2000, 5000]);
  expect(vi.getTimerCount()).toBe(0);
});
