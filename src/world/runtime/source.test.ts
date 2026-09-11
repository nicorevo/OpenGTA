import { afterEach, describe, expect, it, vi } from "vitest";
import { compileRuntimeRegion, createGeoDataSource, createHttpGeoDataSource, createOverpassGeoDataSource, type RuntimeRegionRequest } from "./source.ts";

const request: RuntimeRegionRequest = {
  regionId: "runtime:test",
  origin: { latitude: 40.35, longitude: 18.17 },
  radiusMeters: 300,
};
afterEach(() => vi.useRealTimers());

describe("runtime geo data source", () => {
  it.each([createHttpGeoDataSource, createOverpassGeoDataSource])("bounds native Fetch responses without retrying oversized payloads", async (factory) => {
    vi.useFakeTimers();
    let calls = 0;
    const source = factory("https://example.test", async () => new Response(++calls === 1 ? JSON.stringify({ elements: [], note: "x".repeat(100) }) : '{"elements":[]}'), { maxResponseBytes: 32 });
    const first = source.acquire(request).catch((e) => e);
    await vi.advanceTimersByTimeAsync(0);
    expect(await first).toMatchObject({ code: "response-too-large" });
    expect(calls).toBe(1);
    const next = source.acquire(request); await vi.runAllTimersAsync();
    expect(await next).toEqual({ elements: [] });
  });

  it("requests and compiles minimally tagged parks and parking areas", async () => {
    let query = "";
    const nodes = Array.from({ length: 8 }, (_, i) => ({ type: "node", id: i + 1, lat: request.origin.latitude + (i % 4 > 1 ? 0.0002 : 0), lon: request.origin.longitude + (i % 4 === 1 || i % 4 === 2 ? 0.0002 : 0) + (i >= 4 ? 0.0004 : 0) }));
    const source = createOverpassGeoDataSource(undefined, async (_url, _signal, body) => {
      query = new URLSearchParams(body).get("data")!;
      return new Response(JSON.stringify({ elements: [...nodes, { type: "way", id: 10, nodes: [1, 2, 3, 4, 1], tags: { leisure: "park" } }, { type: "way", id: 11, nodes: [5, 6, 7, 8, 5], tags: { amenity: "parking" } }] }));
    });
    const result = await compileRuntimeRegion(source, request);
    expect(query).toContain('nwr["leisure"="park"]');
    expect(query).toContain('nwr["amenity"="parking"]');
    for (const filter of ['nwr["building"]', 'nwr["highway"]', 'nwr["landuse"]', 'nwr["natural"]', 'nwr["waterway"]', 'nwr["barrier"]']) expect(query).toContain(filter);
    expect(query).toContain("out body;>;out skel qt;");
    expect(result.chunks[0].ground.map((area) => area.styleKey).sort()).toEqual(["land:park", "land:parking"]);
  });
  it.each([null, { elements: [null] }, { elements: [], remark: 7 }])("classifies malformed payloads %j", async (payload) => {
    const source = createOverpassGeoDataSource(undefined, async () => ({ ok: true, status: 200, json: async () => payload }));
    await expect(source.acquire(request)).rejects.toMatchObject({ code: "invalid-response", status: 200 });
  });

  it("preserves parsing cause without exposing provider text", async () => {
    const cause = new SyntaxError("secret provider text");
    const source = createHttpGeoDataSource("https://example.test", async () => ({ ok: true, status: 200, json: async () => { throw cause; } }));
    await expect(source.acquire(request)).rejects.toMatchObject({ code: "invalid-response", status: 200, cause });
  });

  it("rejects partial provider data with a safe message", async () => {
    const source = createOverpassGeoDataSource(undefined, async () => ({ ok: true, status: 200, json: async () => ({ elements: [{ type: "node", id: 1, lat: 0, lon: 0 }], remark: "untrusted secret" }) }));
    await expect(source.acquire(request)).rejects.toMatchObject({ code: "provider-error", message: "OSM provider reported an incomplete response" });
  });
  it("passes arbitrary coordinates through the shared normalize/compile pipeline", async () => {
    let received: RuntimeRegionRequest | undefined;
    const source = createGeoDataSource(async (incoming) => {
      received = incoming;
      return { elements: [] };
    });

    const result = await compileRuntimeRegion(source, request);
    expect(received).toEqual(request);
    expect(result.chunks[0]?.spatial.regionId).toBe("runtime:test");
    expect(result.chunks[0]?.schemaVersion).toBe(0);
  });

  it("rejects malformed responses at the untrusted boundary", async () => {
    const source = createGeoDataSource(async () => ({ elements: [null] }));
    await expect(source.acquire(request)).rejects.toThrow("OSM response");
  });

  it("aborts a source request that exceeds the timeout", async () => {
    const source = createGeoDataSource(() => new Promise(() => undefined), { timeoutMs: 10 });
    await expect(source.acquire(request)).rejects.toThrow("timed out");
  });

  it("enforces the configured acquisition interval", async () => {
    vi.useFakeTimers();
    const starts: number[] = [];
    const source = createGeoDataSource(async () => { starts.push(Date.now()); return { elements: [] }; }, { minIntervalMs: 50 });
    const jobs = Array.from({ length: 4 }, () => source.acquire(request));
    await vi.runAllTimersAsync();
    await Promise.all(jobs);
    expect(starts.map((t) => t - starts[0])).toEqual([0, 50, 100, 150]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects invalid coordinates before calling the source", async () => {
    let calls = 0;
    const source = createGeoDataSource(async () => {
      calls += 1;
      return { elements: [] };
    });
    await expect(source.acquire({ ...request, origin: { latitude: 91, longitude: 18 } })).rejects.toThrow("latitude");
    expect(calls).toBe(0);
  });

  it("builds a bounded HTTP request and validates its status", async () => {
    let requestedUrl = "";
    const source = createHttpGeoDataSource("https://example.test/data", async (url) => {
      requestedUrl = url;
      return { ok: true, status: 200, json: async () => ({ elements: [] }) };
    });
    await expect(source.acquire(request)).resolves.toEqual({ elements: [] });
    expect(new URL(requestedUrl).searchParams.get("bbox")).toContain("40.35");
  });

  it("turns an HTTP error into a source failure", async () => {
    const source = createHttpGeoDataSource("https://example.test/data", async () => ({
      ok: false, status: 429, json: async () => ({ elements: [] }),
    }));
    await expect(source.acquire(request)).rejects.toThrow("HTTP 429");
  });

  it("builds an Overpass POST query with the OSM bbox and recursion", async () => {
    let body = "";
    const source = createOverpassGeoDataSource("https://overpass.test/api/interpreter", async (_url, _signal, requestBody) => {
      body = requestBody ?? "";
      return { ok: true, status: 200, json: async () => ({ elements: [] }) };
    });
    await source.acquire(request);
    const query = decodeURIComponent(body.replace(/^data=/, ""));
    expect(query).toContain("[out:json]");
    expect(query).toContain("nwr[\"building\"]");
    expect(query).toContain("out skel qt");
  });

  it("rejects an Overpass provider remark even when HTTP succeeds", async () => {
    const source = createOverpassGeoDataSource("https://overpass.test/api/interpreter", async () => ({
      ok: true,
      status: 200,
      json: async () => ({ remark: "runtime error: Query timed out", elements: [] }),
    }));
    await expect(source.acquire(request)).rejects.toMatchObject({ code: "provider-error" });
  });

  it("retries transient Overpass throttling", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const source = createOverpassGeoDataSource("https://overpass.test/api/interpreter", async () => {
      calls += 1;
      return calls === 1
        ? { ok: false, status: 429, json: async () => ({}) }
        : { ok: true, status: 200, json: async () => ({ elements: [] }) };
    }, { maxRetries: 1, retryDelayMs: 0 });
    const result = expect(source.acquire(request)).resolves.toEqual({ elements: [] });
    await vi.runAllTimersAsync(); await result;
    expect(calls).toBe(2);
  });

  it("keeps the configured endpoint when the default Overpass endpoint is unavailable", async () => {
    vi.useFakeTimers();
    const endpoints: string[] = [];
    const source = createOverpassGeoDataSource(undefined, async (url) => {
      endpoints.push(url);
      return { ok: false, status: 503, json: async () => ({}) };
    }, { maxRetries: 1, retryDelayMs: 0 });
    const result = expect(source.acquire(request)).rejects.toThrow("HTTP 503");
    await vi.runAllTimersAsync(); await result;
    expect(endpoints).toEqual([
      "https://overpass-api.de/api/interpreter",
      "https://overpass-api.de/api/interpreter",
    ]);
  });

  it("does not rotate endpoints after a network failure", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const source = createOverpassGeoDataSource(undefined, async () => {
      calls += 1;
      throw new Error("fetch failed");
    }, { maxRetries: 1, retryDelayMs: 0 });
    const result = expect(source.acquire(request)).rejects.toThrow("fetch failed");
    await vi.runAllTimersAsync(); await result;
    expect(calls).toBe(2);
  });
});

it("records real acquisition, decode, normalize and compile phases", async () => {
  const source = createHttpGeoDataSource("https://example.test", async () => new Response(JSON.stringify({ elements: [{ type: "node", id: 1, lat: request.origin.latitude, lon: request.origin.longitude }, { type: "way", id: 10, nodes: [1, 1], tags: { highway: "residential" } }] })));
  const result = await compileRuntimeRegion(source, request);
  const phases = result.diagnostics.stageDurationsMs;
  expect(phases.acquire).toBeGreaterThan(0);
  expect(phases.decode).toBeGreaterThan(0);
  expect(phases.normalize).toBeGreaterThan(0);
  expect(phases.compile).toBeGreaterThan(0);
  expect(phases.total).toBeGreaterThanOrEqual((phases.acquire ?? 0) + (phases.normalize ?? 0) + (phases.compile ?? 0));
});
