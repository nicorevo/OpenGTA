import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { decodeVectorTile } from "../../geo/mvt/decode.ts";
import { createChunkGrid } from "../chunk/grid.ts";
import { createChunkCache } from "../chunk/cache.ts";
import type { CompiledChunkV0 } from "../compiler/compiled.ts";
import { createGeoDataSource } from "./source.ts";
import { createOpenWorldRuntime } from "./open-world.ts";
import { createOverpassCanonicalRegionSource, createVectorTileCanonicalRegionSource } from "./canonical-source.ts";

const ORIGIN = { latitude: 40.35316888888889, longitude: 18.17259 };
const grid = createChunkGrid(300);
const windowInput = { position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, cameraBounds: { minX: -300, minY: -300, maxX: 300, maxY: 300 } };
const rawFixture = JSON.parse(readFileSync(new URL("../../fixtures/geo/lecce-sant-oronzo-v0.raw.json", import.meta.url), "utf8"));
const rawFixtureCopy = () => JSON.parse(JSON.stringify(rawFixture));
const tileBytes = new Uint8Array(readFileSync(new URL("../../fixtures/geo/lecce-z14-openfreemap.pbf", import.meta.url)));

function chunkFingerprint(chunk: CompiledChunkV0) {
  return {
    bounds: chunk.spatial.bounds,
    regionId: chunk.spatial.regionId,
    roads: chunk.roads.map((road) => [road.featureId, road.widthMeters]),
    buildings: chunk.buildings.map((building) => building.featureId),
    collisions: chunk.collisions.length,
    features: Object.keys(chunk.featureIndex).sort(),
  };
}

it("produces the same chunk as the legacy source path for the Overpass fixture", async () => {
  const legacy = createOpenWorldRuntime({
    baseOrigin: ORIGIN, grid, cache: createChunkCache(9), compilerVersion: "v0-runtime",
    source: createGeoDataSource(async () => rawFixtureCopy(), { minIntervalMs: 0 }),
    sourceIdentity: "osm-overpass:https://example.test/api/interpreter", queryProfile: "osm-v1-park-parking",
  });
  const legacyWindow = await legacy.loadWindow(windowInput);
  expect(legacyWindow.loaded.length).toBeGreaterThan(0);
  const legacyChunk = await legacy.load({ x: 0, y: 0 });

  const canonical = createOpenWorldRuntime({
    baseOrigin: ORIGIN, grid, cache: createChunkCache(9), compilerVersion: "v0-runtime",
    regionSource: createOverpassCanonicalRegionSource({
      source: createGeoDataSource(async () => rawFixtureCopy(), { minIntervalMs: 0 }),
      identity: "osm-overpass:https://example.test/api/interpreter",
      profile: "osm-v1-park-parking",
    }),
  });
  const canonicalWindow = await canonical.loadWindow(windowInput);
  expect(canonicalWindow.loaded.length).toBeGreaterThan(0);
  const canonicalChunk = await canonical.load({ x: 0, y: 0 });

  expect(chunkFingerprint(canonicalChunk)).toEqual(chunkFingerprint(legacyChunk));
  await legacy.dispose();
  await canonical.dispose();
});

it("compiles the MVT fixture through the canonical contract without any GeoDataSource", async () => {
  const provider = { id: "stub", datasetVersion: "20260830_080001_pt", getTile: vi.fn(async () => decodeVectorTile(tileBytes)) };
  const runtime = createOpenWorldRuntime({
    baseOrigin: ORIGIN, grid, cache: createChunkCache(9), compilerVersion: "v0-runtime",
    regionSource: createVectorTileCanonicalRegionSource({ provider, identity: "openfreemap-mvt:stub" }),
  });
  const window = await runtime.loadWindow(windowInput);
  expect(window.loaded.length).toBeGreaterThan(0);
  expect(window.failed).toHaveLength(0);
  const chunk = await runtime.load({ x: 0, y: 0 });
  expect(chunk.roads.length).toBeGreaterThan(0);
  expect(chunk.buildings.length).toBeGreaterThan(0);
  expect(chunk.collisions.length).toBeGreaterThan(0);
  expect(chunk.diagnostics.stageDurationsMs.acquire).toBeGreaterThan(0);
  expect(provider.getTile).toHaveBeenCalled();
  await runtime.dispose();
});

it("keeps canonical-source namespaces isolated even on a shared cache", async () => {
  const cache = createChunkCache<CompiledChunkV0>(9);
  const overpassProvider = createGeoDataSource(async () => rawFixtureCopy(), { minIntervalMs: 0 });
  const overpass = createOpenWorldRuntime({
    baseOrigin: ORIGIN, grid, cache, compilerVersion: "v0-runtime",
    regionSource: createOverpassCanonicalRegionSource({ source: overpassProvider, identity: "osm-overpass:a", profile: "osm-v1-park-parking" }),
  });
  await overpass.loadWindow(windowInput);
  expect(cache.size).toBeGreaterThan(0);

  const provider = { id: "stub", datasetVersion: "test", getTile: vi.fn(async () => decodeVectorTile(tileBytes)) };
  const mvt = createOpenWorldRuntime({
    baseOrigin: ORIGIN, grid, cache, compilerVersion: "v0-runtime",
    regionSource: createVectorTileCanonicalRegionSource({ provider, identity: "openfreemap-mvt:b" }),
  });
  const mvtWindow = await mvt.loadWindow(windowInput);
  expect(mvtWindow.loaded.length).toBeGreaterThan(0);
  // The Overpass record must never satisfy the MVT demand: the provider ran.
  expect(provider.getTile).toHaveBeenCalled();
  expect(cache.size).toBeGreaterThanOrEqual(2);
  await overpass.dispose();
  await mvt.dispose();
});
