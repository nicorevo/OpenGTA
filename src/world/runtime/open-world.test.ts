import { describe, expect, it } from "vitest";
import type { CompiledChunkV0 } from "../compiler/compiled.ts";
import { createChunkCache } from "../chunk/cache.ts";
import { createChunkGrid } from "../chunk/grid.ts";
import { createGeoDataSource } from "./source.ts";
import { createOpenWorldRuntime } from "./open-world.ts";

function emptyChunk(id: string): CompiledChunkV0 {
  return {
    schemaVersion: 0,
    id,
    spatial: { regionId: id, bounds: { minX: -300, minY: -300, maxX: 300, maxY: 300 }, originOffset: { x: 0, y: 0 } },
    ground: [], roads: [], buildings: [], labels: [], collisions: [], featureIndex: {},
    diagnostics: { inputFeatureCount: 0, compiledFeatureCount: 0, skippedFeatureCount: 0, warnings: [], stageDurationsMs: { total: 0 } },
  };
}

describe("open world runtime coordinator", () => {
  const request = {
    position: { x: 0, y: 0 },
    velocity: { x: 100, y: 0 },
    cameraBounds: { minX: -50, minY: -50, maxX: 50, maxY: 50 },
  };

  it("loads and activates P0 before progressively loading neighbors", async () => {
    const order: string[] = [];
    const source = createGeoDataSource(async (incoming) => {
      order.push(incoming.regionId);
      return { elements: [] };
    });
    const runtime = createOpenWorldRuntime({
      baseOrigin: { latitude: 40.35, longitude: 18.17 },
      cache: createChunkCache(8),
      compilerVersion: "test-v1",
      grid: createChunkGrid(300),
      source,
    });

    const result = await runtime.loadWindow(request);
    expect(result.loaded[0]?.priority).toBe("P0");
    expect(runtime.state({ x: 0, y: 0 })).toBe("ACTIVE");
    expect(order[0]).toBe("open-world:chunk:0:0");
    expect(result.failed).toEqual([]);
  });

  it("reuses a compiled chunk from the shared cache", async () => {
    let calls = 0;
    const cache = createChunkCache<CompiledChunkV0>(2);
    const source = createGeoDataSource(async () => {
      calls += 1;
      return { elements: [] };
    });
    const options = { baseOrigin: { latitude: 40.35, longitude: 18.17 }, cache, compilerVersion: "test-v1", grid: createChunkGrid(300), source };
    const first = createOpenWorldRuntime(options);
    await first.load({ x: 0, y: 0 });
    const second = createOpenWorldRuntime(options);
    await second.load({ x: 0, y: 0 });

    expect(calls).toBe(1);
  });

  it("keeps P0 active when a neighbor source fails", async () => {
    const source = createGeoDataSource(async (incoming) => {
      if (incoming.regionId.endsWith("1:0")) throw new Error("neighbor unavailable");
      return { elements: [] };
    });
    const runtime = createOpenWorldRuntime({
      baseOrigin: { latitude: 40.35, longitude: 18.17 },
      cache: createChunkCache(8),
      compilerVersion: "test-v1",
      grid: createChunkGrid(300),
      source,
    });

    const result = await runtime.loadWindow(request);
    expect(runtime.state({ x: 0, y: 0 })).toBe("ACTIVE");
    expect(result.failed.some((failure) => failure.key.x === 1 && failure.key.y === 0)).toBe(true);
  });

  it("returns the compiled value for a single chunk", async () => {
    const expected = emptyChunk("open-world:chunk:0:0");
    const runtime = createOpenWorldRuntime({
      baseOrigin: { latitude: 40.35, longitude: 18.17 },
      cache: createChunkCache(2),
      compilerVersion: "test-v1",
      grid: createChunkGrid(300),
      source: createGeoDataSource(async () => ({ elements: [] })),
      compile: async () => expected,
    });
    await expect(runtime.load({ x: 0, y: 0 })).resolves.toBe(expected);
  });
});
