import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { createOpenFreeMapProvider } from "./provider.ts";
const fixtureBytes = new Uint8Array(readFileSync(new URL("../../../fixtures/geo/lecce-z14-openfreemap.pbf", import.meta.url)));

afterEach(() => vi.unstubAllGlobals());

it("fetches and decodes the pinned Lecce tile", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    expect(url).toContain("/planet/20260830_080001_pt/14/9019/6181.pbf");
    return new Response(fixtureBytes, { status: 200 });
  }));
  const provider = createOpenFreeMapProvider();
  const tile = await provider.getTile({ z: 14, x: 9019, y: 6181 }, new AbortController().signal);
  expect(tile?.layerCount).toBe(11);
  expect(tile?.layers.some((layer) => layer.name === "transportation")).toBe(true);
  expect(provider.id).toBe("openfreemap:planet");
  expect(provider.datasetVersion).toBe("20260830_080001_pt");
});

it("returns null for 404 and 204 as deterministic empty tiles", async () => {
  for (const status of [404, 204]) {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status })));
    const provider = createOpenFreeMapProvider();
    await expect(provider.getTile({ z: 14, x: 0, y: 0 }, new AbortController().signal)).resolves.toBeNull();
  }
});

it("classifies network, timeout and oversized payloads distinctly", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
  await expect(createOpenFreeMapProvider().getTile({ z: 14, x: 0, y: 0 }, new AbortController().signal)).rejects.toMatchObject({ code: "network" });

  vi.stubGlobal("fetch", vi.fn(async () => new Response(fixtureBytes, { status: 200 })));
  await expect(createOpenFreeMapProvider({ maxTileBytes: 100 }).getTile({ z: 14, x: 9019, y: 6181 }, new AbortController().signal)).rejects.toMatchObject({ code: "response-too-large" });
});

it("retries once honoring Retry-After, then serves the tile", async () => {
  vi.useFakeTimers();
  try {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { "retry-after": "1" } }))
      .mockResolvedValueOnce(new Response(fixtureBytes, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const pending = createOpenFreeMapProvider().getTile({ z: 14, x: 9019, y: 6181 }, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toMatchObject({ layerCount: 11 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
  }
});

it("gives up after a single retry, surfacing the last Retry-After", async () => {
  vi.useFakeTimers();
  try {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 429, headers: { "retry-after": "2" } }));
    vi.stubGlobal("fetch", fetchMock);
    const pending = createOpenFreeMapProvider().getTile({ z: 14, x: 0, y: 0 }, new AbortController().signal);
    // Capture the rejection up front so it is handled while the fake clock advances.
    const captured = pending.then(
      (value) => { throw new Error(`expected rejection, resolved with ${value}`); },
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(5000);
    await expect(captured).resolves.toMatchObject({ code: "http", status: 429, retryAfterMs: 2000 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
  }
});

it("does not retry non-retryable HTTP statuses", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(createOpenFreeMapProvider().getTile({ z: 14, x: 0, y: 0 }, new AbortController().signal)).rejects.toMatchObject({ code: "http", status: 403 });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("limits concurrent tile fetches to maxConcurrentFetches", async () => {
  let active = 0;
  let peak = 0;
  vi.stubGlobal("fetch", vi.fn(async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active -= 1;
    return new Response(fixtureBytes, { status: 200 });
  }));
  const provider = createOpenFreeMapProvider({ maxConcurrentFetches: 2 });
  const keys = Array.from({ length: 6 }, (_, index) => ({ z: 14, x: index, y: 0 }));
  await Promise.all(keys.map((key) => provider.getTile(key, new AbortController().signal)));
  expect(peak).toBeLessThanOrEqual(2);
  expect(fetch).toHaveBeenCalledTimes(6);
});

it("fetches a tile only once for concurrent and repeated demands", async () => {
  let calls = 0;
  vi.stubGlobal("fetch", vi.fn(async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return new Response(fixtureBytes, { status: 200 });
  }));
  const provider = createOpenFreeMapProvider();
  const key = { z: 14, x: 9019, y: 6181 };
  const signal = new AbortController().signal;
  const [first, second] = await Promise.all([provider.getTile(key, signal), provider.getTile(key, signal)]);
  expect(calls).toBe(1);
  expect(first).toBe(second);
  await provider.getTile(key, signal);
  expect(calls).toBe(1);
});

it("cancels the stream when the byte budget is exceeded", async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(200).fill(1));
      controller.enqueue(new Uint8Array(200).fill(1));
    },
    cancel() { cancelled = true; },
  });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(stream, { status: 200 })));
  await expect(createOpenFreeMapProvider({ maxTileBytes: 100 }).getTile({ z: 14, x: 0, y: 0 }, new AbortController().signal)).rejects.toMatchObject({ code: "response-too-large" });
  expect(cancelled).toBe(true);
});

it("propagates abort and never retries", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  vi.stubGlobal("fetch", vi.fn(async () => { calls++; throw new TypeError("refused"); }));
  await expect(createOpenFreeMapProvider().getTile({ z: 14, x: 0, y: 0 }, controller.signal)).rejects.toMatchObject({ code: "aborted" });
  expect(calls).toBe(0);
});
