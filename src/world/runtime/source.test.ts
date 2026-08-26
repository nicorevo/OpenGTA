import { describe, expect, it } from "vitest";
import { compileRuntimeRegion, createGeoDataSource, type RuntimeRegionRequest } from "./source.ts";

const request: RuntimeRegionRequest = {
  regionId: "runtime:test",
  origin: { latitude: 40.35, longitude: 18.17 },
  radiusMeters: 300,
};

describe("runtime geo data source", () => {
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
});
