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
  it("reconciles a rapid return while removal is still committing", async () => {
    let finishRemoval!: () => void;
    let removalStarted!: () => void;
    const started = new Promise<void>((resolve) => { removalStarted = resolve; });
    let once = true;
    const applied = new Set<string>();
    const runtime = createOpenWorldRuntime({ baseOrigin: { latitude: 0, longitude: 0 }, grid: createChunkGrid(300), cache: createChunkCache(9), compilerVersion: "test", source: createGeoDataSource(async () => ({ elements: [] })), compile: async (key) => emptyChunk(`chunk:${key.x}:${key.y}`),
      onChunkReady: (chunk) => { applied.add(chunk.id); },
      onChunkRemoved: async (key) => { if (once) { once = false; removalStarted(); await new Promise<void>((resolve) => { finishRemoval = resolve; }); } applied.delete(`chunk:${key.x}:${key.y}`); },
    });
    const input = (x: number) => ({ position: { x: x * 300 + 10, y: 10 }, velocity: { x: 0, y: 0 }, cameraBounds: { minX: x * 300 + 1, maxX: x * 300 + 200, minY: 1, maxY: 200 } });
    await runtime.loadWindow(input(0));
    const away = runtime.loadWindow(input(1)); await started;
    const back = runtime.loadWindow(input(0)); finishRemoval();
    await Promise.all([away, back]);
    expect(runtime.state({ x: 0, y: 0 })).toBe("ACTIVE");
    expect(applied).toEqual(new Set(["chunk:0:0"]));
    await runtime.dispose();
  });
  it("publishes a ready chunk before neighbors and awaits application before activation", async () => {
    let finishNeighbor!: (chunk: CompiledChunkV0) => void;
    let finishApply!: () => void;
    const applied: string[] = [];
    const runtime = createOpenWorldRuntime({ baseOrigin: { latitude: 0, longitude: 0 }, grid: createChunkGrid(300), cache: createChunkCache(9), compilerVersion: "test", source: createGeoDataSource(async () => ({ elements: [] })),
      compile: async (key) => key.x === 1 ? new Promise((resolve) => { finishNeighbor = resolve; }) : emptyChunk("chunk:0:0"),
      onChunkReady: async (chunk) => { applied.push(chunk.id); await new Promise<void>((resolve) => { finishApply = resolve; }); },
    });
    const window = runtime.loadWindow({ position: { x: 10, y: 10 }, velocity: { x: 1, y: 0 }, cameraBounds: { minX: 1, minY: 1, maxX: 200, maxY: 200 } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(applied).toEqual(["chunk:0:0"]);
    expect(runtime.state({ x: 0, y: 0 })).toBe("READY");
    finishApply();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(runtime.state({ x: 0, y: 0 })).toBe("ACTIVE");
    finishNeighbor(emptyChunk("chunk:1:0"));
    await new Promise((resolve) => setTimeout(resolve, 0)); finishApply();
    expect((await window).loaded).toHaveLength(2);
    await runtime.dispose();
  });

  it("bounds retention across 100 windows, keeps pins and reuses warm chunks", async () => {
    let calls = 0;
    const applied = new Set<string>();
    const runtime = createOpenWorldRuntime({ baseOrigin: { latitude: 0, longitude: 0 }, grid: createChunkGrid(300), cache: createChunkCache(9), compilerVersion: "test", source: createGeoDataSource(async () => ({ elements: [] })),
      compile: async (key) => { calls++; return emptyChunk(`chunk:${key.x}:${key.y}`); },
      onChunkReady: (chunk) => { applied.add(chunk.id); }, onChunkRemoved: (key) => { applied.delete(`chunk:${key.x}:${key.y}`); },
    });
    const input = (x: number) => ({ position: { x: x * 300 + 10, y: 10 }, velocity: { x: 0, y: 0 }, cameraBounds: { minX: x * 300 + 1, maxX: x * 300 + 200, minY: 1, maxY: 200 } });
    for (let x = 0; x < 100; x++) {
      await runtime.loadWindow(input(x), { pinnedKeys: [{ x: 0, y: 0 }] });
      const snapshot = runtime.snapshot();
      expect(snapshot.records).toBeLessThanOrEqual(2);
      expect(snapshot.cacheSize).toBeLessThanOrEqual(9);
      expect(applied.size).toBeLessThanOrEqual(2);
    }
    const before = calls;
    await runtime.loadWindow(input(98));
    expect(calls).toBe(before);
    expect(applied).toEqual(new Set(["chunk:98:0"]));
    await runtime.dispose();
    expect(runtime.snapshot().records).toBe(0);
    expect(applied.size).toBe(0);
  });

  it("cancels stale results and does not retry an unchanged failure", async () => {
    let resolveOld!: (chunk: CompiledChunkV0) => void;
    let calls = 0;
    const applied: string[] = [];
    const runtime = createOpenWorldRuntime({ baseOrigin: { latitude: 0, longitude: 0 }, grid: createChunkGrid(300), cache: createChunkCache(9), compilerVersion: "test", source: createGeoDataSource(async () => ({ elements: [] })),
      compile: async (key) => { calls++; if (key.x === 0) return new Promise((resolve) => { resolveOld = resolve; }); throw new Error("unavailable"); },
      onChunkReady: (chunk) => { applied.push(chunk.id); },
    });
    const input = (x: number) => ({ position: { x: x * 300 + 10, y: 10 }, velocity: { x: 0, y: 0 }, cameraBounds: { minX: x * 300 + 1, maxX: x * 300 + 200, minY: 1, maxY: 200 } });
    const old = runtime.loadWindow(input(0)); await Promise.resolve();
    expect((await runtime.loadWindow(input(1))).failed).toHaveLength(1);
    await runtime.loadWindow(input(1)); expect(calls).toBe(2);
    resolveOld(emptyChunk("obsolete")); await old;
    expect(applied).toEqual([]);
    expect(runtime.state({ x: 0, y: 0 })).toBeUndefined();
    await runtime.dispose();
  });
  it("isolates worlds, sources and query profiles in a shared cache", async () => {
    let calls = 0;
    const source = createGeoDataSource(async () => { calls++; return { elements: [] }; });
    const options = { source, cache: createChunkCache<CompiledChunkV0>(9), compilerVersion: "v1", grid: createChunkGrid(300), baseOrigin: { latitude: 40, longitude: 18 }, sourceIdentity: "fixture", queryProfile: "v1" };
    for (const variant of [{}, { baseOrigin: { latitude: 41, longitude: 18 } }, { sourceIdentity: "other" }, { queryProfile: "v2" }, { compilerVersion: "v2" }]) {
      await createOpenWorldRuntime({ ...options, ...variant }).load({ x: 0, y: 0 });
    }
    expect(calls).toBe(5);
    await createOpenWorldRuntime(options).load({ x: 0, y: 0 });
    expect(calls).toBe(5);
  });
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
