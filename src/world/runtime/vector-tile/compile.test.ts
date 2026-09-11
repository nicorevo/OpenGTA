import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { decodeVectorTile } from "../../../geo/mvt/decode.ts";
import { TileSourceError } from "../../../geo/mvt/errors.ts";
import { createTangentProjector } from "../../../geo/coordinates/projector.ts";
import { createChunkGrid } from "../../chunk/grid.ts";
import { createChunkCache } from "../../chunk/cache.ts";
import { createGeoDataSource } from "../source.ts";
import { createOpenWorldRuntime } from "../open-world.ts";
import { createMvtChunkCompiler } from "./compile.ts";
import type { VectorTileProvider } from "./provider.ts";

const ORIGIN = { latitude: 40.35316888888889, longitude: 18.17259 };
const TILE = { z: 14, x: 9019, y: 6181 };
const fixtureBytes = new Uint8Array(readFileSync(new URL("../../../fixtures/geo/lecce-z14-openfreemap.pbf", import.meta.url)));
const grid = createChunkGrid(300);
const projector = createTangentProjector(ORIGIN);
const key = { x: 0, y: 0 };
const cellBounds = grid.boundsForKey(key);
const request = {
  regionId: "open-world:chunk:0:0",
  origin: projector.unproject({ x: (cellBounds.minX + cellBounds.maxX) / 2, y: (cellBounds.minY + cellBounds.maxY) / 2 }),
  radiusMeters: 300,
};
const context = { signal: new AbortController().signal };

const fixtureProvider = (): VectorTileProvider => ({
  id: "stub",
  datasetVersion: "20260830_080001_pt",
  getTile: vi.fn(async (tile) => (tile.z === 14 ? decodeVectorTile(fixtureBytes) : null)),
});

it("compiles a chunk from the fixture tile through the seam", async () => {
  const provider = fixtureProvider();
  const compile = createMvtChunkCompiler({ provider, grid, origin: ORIGIN });
  const chunk = await compile(key, request, context);
  expect(chunk.spatial.regionId).toBe(request.regionId);
  expect(chunk.spatial.bounds).toEqual(cellBounds);
  expect(chunk.roads.length).toBeGreaterThan(0);
  expect(chunk.buildings.length).toBeGreaterThan(0);
  expect(chunk.collisions.length).toBeGreaterThan(0);
  expect(Object.keys(chunk.featureIndex).length).toBeGreaterThan(0);
});

it("propagates tile errors so the runtime degrades instead of crashing", async () => {
  const failing: VectorTileProvider = { id: "stub", datasetVersion: "test", getTile: async () => { throw new TileSourceError("network", "tile fetch failed"); } };
  const compile = createMvtChunkCompiler({ provider: failing, grid, origin: ORIGIN });
  await expect(compile(key, request, context)).rejects.toMatchObject({ code: "network" });

  const runtime = createOpenWorldRuntime({
    baseOrigin: ORIGIN, grid, cache: createChunkCache(9), compilerVersion: "v0-runtime",
    source: createGeoDataSource(async () => { throw new Error("never invoked"); }, { minIntervalMs: 0 }),
    sourceIdentity: "openfreemap-mvt:test", queryProfile: "mvt-z14-v1",
    compile,
  });
  const result = await runtime.loadWindow({ position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, cameraBounds: { minX: -300, minY: -300, maxX: 300, maxY: 300 } });
  expect(result.failed.length).toBeGreaterThan(0);
  expect(Object.values(runtime.snapshot().errors)).toContain("network");
  await runtime.dispose();
});

it("keeps the MVT cache namespace isolated from the Overpass one", async () => {
  const raw = JSON.parse(readFileSync(new URL("../../../fixtures/geo/lecce-sant-oronzo-v0.raw.json", import.meta.url), "utf8"));
  const cache = createChunkCache<import("../../compiler/compiled.ts").CompiledChunkV0>(9);
  const windowInput = { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, cameraBounds: { minX: -300, minY: -300, maxX: 300, maxY: 300 } };

  const overpassRuntime = createOpenWorldRuntime({
    baseOrigin: ORIGIN, grid, cache, compilerVersion: "v0-runtime",
    source: createGeoDataSource(async () => raw, { minIntervalMs: 0 }),
    sourceIdentity: "osm-overpass:https://example.test/api/interpreter", queryProfile: "osm-v1-park-parking",
  });
  const overpassWindow = await overpassRuntime.loadWindow(windowInput);
  expect(overpassWindow.loaded.length).toBeGreaterThan(0);
  expect(cache.size).toBeGreaterThan(0);

  const provider = fixtureProvider();
  const mvtRuntime = createOpenWorldRuntime({
    baseOrigin: ORIGIN, grid, cache, compilerVersion: "v0-runtime",
    source: createGeoDataSource(async () => { throw new Error("never invoked"); }, { minIntervalMs: 0 }),
    sourceIdentity: "openfreemap-mvt:https://tiles.openfreemap.org/planet/20260830_080001_pt", queryProfile: "mvt-z14-v1",
    compile: createMvtChunkCompiler({ provider, grid, origin: ORIGIN }),
  });
  const mvtWindow = await mvtRuntime.loadWindow(windowInput);
  expect(mvtWindow.loaded.length).toBeGreaterThan(0);
  // The Overpass record must never satisfy the MVT demand: the provider ran.
  expect((provider.getTile as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  expect(cache.size).toBeGreaterThanOrEqual(2);

  await overpassRuntime.dispose();
  await mvtRuntime.dispose();
});
