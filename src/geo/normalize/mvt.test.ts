import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { decodeVectorTile } from "../mvt/decode.ts";
import { compileRegion } from "../../world/compiler/compiled.ts";
import { normalizeMvtTiles } from "./mvt.ts";

const TILE = { z: 14, x: 9019, y: 6181 };
const ORIGIN = { latitude: 40.35316888888889, longitude: 18.17259 };
const decoded = decodeVectorTile(new Uint8Array(readFileSync(new URL("../../fixtures/geo/lecce-z14-openfreemap.pbf", import.meta.url))));

it("turns a decoded tile into a canonical WorldRegion coherent with the DATA-09 parity", () => {
  const { region, raw } = normalizeMvtTiles({ tiles: [{ tile: TILE, decoded }], origin: ORIGIN, regionId: "mvt-canonical" });
  // Counts pinned by DATA-09 (MVT-LECCE-PARITY.md, refreshed after the
  // DATA-12 own-area clip): same fixture, same window.
  expect(raw.roads).toBeGreaterThan(500);
  expect(region.roads).toHaveLength(75);
  expect(region.buildings).toHaveLength(127);
  expect(region.landAreas).toHaveLength(10);
  expect(region.waterAreas).toHaveLength(0);
  expect(region.barriers).toHaveLength(0); // declared gap
  expect(region.trees).toHaveLength(0);    // declared gap
  expect(region.bounds).toEqual({ minX: -300, minY: -300, maxX: 300, maxY: 300 });
  expect(region.geoOrigin).toEqual(ORIGIN);
  expect(region.id).toBe("mvt-canonical");
  for (const road of region.roads) expect(road.id.startsWith("mvt:transportation:")).toBe(true);
  for (const building of region.buildings) expect(building.id.startsWith("mvt:building:")).toBe(true);
});

it("compiles through the single canonical compiler with the DATA-09 compiled counts", () => {
  const { region } = normalizeMvtTiles({ tiles: [{ tile: TILE, decoded }], origin: ORIGIN, regionId: "mvt-canonical" });
  const result = compileRegion(region);
  expect(result.chunks).toHaveLength(1);
  const chunk = result.chunks[0];
  expect(chunk.roads).toHaveLength(75);
  expect(chunk.buildings).toHaveLength(127);
  expect(chunk.collisions).toHaveLength(127);
  expect(chunk.featureIndex).toBeDefined();
});

it("is deterministic across runs of the same tile", () => {
  const first = normalizeMvtTiles({ tiles: [{ tile: TILE, decoded }], origin: ORIGIN, regionId: "mvt-canonical" });
  const second = normalizeMvtTiles({ tiles: [{ tile: TILE, decoded }], origin: ORIGIN, regionId: "mvt-canonical" });
  expect(second.region.roads.map((road) => road.id)).toEqual(first.region.roads.map((road) => road.id));
  expect(second.region.buildings.map((building) => building.id)).toEqual(first.region.buildings.map((building) => building.id));
  expect(second.region.landAreas.map((area) => area.id)).toEqual(first.region.landAreas.map((area) => area.id));
});
