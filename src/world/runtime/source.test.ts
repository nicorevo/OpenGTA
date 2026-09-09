import { describe, expect, it } from "vitest";
import { compileRuntimeRegion, createGeoDataSource, createHttpGeoDataSource, createOverpassGeoDataSource, type RuntimeRegionRequest } from "./source.ts";

const request: RuntimeRegionRequest = {
  regionId: "runtime:test",
  origin: { latitude: 40.35, longitude: 18.17 },
  radiusMeters: 300,
};

describe("runtime geo data source", () => {
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
    let now = 100;
    const source = createGeoDataSource(async () => ({ elements: [] }), { minIntervalMs: 50, now: () => now });
    await source.acquire(request);
    now = 120;
    await expect(source.acquire(request)).rejects.toThrow("rate limit");
    now = 151;
    await expect(source.acquire(request)).resolves.toEqual({ elements: [] });
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
    let calls = 0;
    const source = createOverpassGeoDataSource("https://overpass.test/api/interpreter", async () => {
      calls += 1;
      return calls === 1
        ? { ok: false, status: 429, json: async () => ({}) }
        : { ok: true, status: 200, json: async () => ({ elements: [] }) };
    }, { maxRetries: 1, retryDelayMs: 0 });
    await expect(source.acquire(request)).resolves.toEqual({ elements: [] });
    expect(calls).toBe(2);
  });

  it("keeps the configured endpoint when the default Overpass endpoint is unavailable", async () => {
    const endpoints: string[] = [];
    const source = createOverpassGeoDataSource(undefined, async (url) => {
      endpoints.push(url);
      return { ok: false, status: 503, json: async () => ({}) };
    }, { maxRetries: 1, retryDelayMs: 0 });
    await expect(source.acquire(request)).rejects.toThrow("HTTP 503");
    expect(endpoints).toEqual([
      "https://overpass-api.de/api/interpreter",
      "https://overpass-api.de/api/interpreter",
    ]);
  });

  it("does not rotate endpoints after a network failure", async () => {
    let calls = 0;
    const source = createOverpassGeoDataSource(undefined, async () => {
      calls += 1;
      throw new Error("fetch failed");
    }, { maxRetries: 1, retryDelayMs: 0 });
    await expect(source.acquire(request)).rejects.toThrow("fetch failed");
    expect(calls).toBe(2);
  });
});
