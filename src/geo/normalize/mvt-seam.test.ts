import { expect, it } from "vitest";
import { tileBounds } from "../mvt/math.ts";
import type { DecodedVectorFeature, DecodedVectorTile } from "../mvt/decode.ts";
import { createTangentProjector } from "../coordinates/projector.ts";
import { normalizeMvtTiles } from "./mvt.ts";
import { ringArea, type Polygon2D } from "../../world/model/types.ts";

const WEST = { z: 14, x: 9019, y: 6181 };
const EAST = { z: 14, x: 9020, y: 6181 };
const SEAM_LON = tileBounds(14, 9019, 6181).east;
const WEST_LON = tileBounds(14, 9019, 6181).west;
// Origin ~150 m west of the tile seam: the canonical V0 box straddles it.
const ORIGIN = { latitude: 40.35316888888889, longitude: SEAM_LON - 0.001768 };
const projector = createTangentProjector(ORIGIN);

const lineFeature = (layer: string, id: number, points: number[][]): DecodedVectorFeature => ({
  layer, id, properties: { class: "minor" },
  geometry: { type: "line", lines: [points.map(([x, y]) => ({ x, y }))] },
});

const polyFeature = (layer: string, id: number, outer: number[][], holes: number[][][] = []): DecodedVectorFeature => ({
  layer, id, properties: {},
  geometry: { type: "polygon", polygons: [{ exterior: outer.map(([x, y]) => ({ x, y })), holes: holes.map((hole) => hole.map(([x, y]) => ({ x, y }))) }] },
});

const tile = (name: string, features: DecodedVectorFeature[]): DecodedVectorTile => ({
  byteLength: 0, layerCount: 1, featureCount: features.length,
  layers: [{ name, version: 2, extent: 4096, features }],
});

/** Meters per tile unit, from the projected tile corners on the region plane. */
const unitMetersX = (() => {
  const seam = projector.project({ latitude: ORIGIN.latitude, longitude: SEAM_LON });
  const west = projector.project({ latitude: ORIGIN.latitude, longitude: WEST_LON });
  return Math.abs(seam.x - west.x) / 4096;
})();
const unitMetersY = (() => {
  const geo = tileBounds(14, 9019, 6181);
  const north = projector.project({ latitude: geo.north, longitude: ORIGIN.longitude });
  const south = projector.project({ latitude: geo.south, longitude: ORIGIN.longitude });
  return Math.abs(north.y - south.y) / 4096;
})();

function areaOf(polygon: Polygon2D): number {
  return Math.abs(ringArea(polygon.outer)) - polygon.holes.reduce((sum, hole) => sum + Math.abs(ringArea(hole)), 0);
}

// Build the two tiles manually per case for full control over local coords.
function normalizeWith(features: { west: DecodedVectorFeature[]; east: DecodedVectorFeature[] }): ReturnType<typeof normalizeMvtTiles> {
  const west = tile("transportation", features.west.filter((f) => f.layer === "transportation"));
  const westBuilding = tile("building", features.west.filter((f) => f.layer === "building"));
  const westPark = tile("park", features.west.filter((f) => f.layer === "park"));
  const east = tile("transportation", features.east.filter((f) => f.layer === "transportation"));
  const eastBuilding = tile("building", features.east.filter((f) => f.layer === "building"));
  const eastPark = tile("park", features.east.filter((f) => f.layer === "park"));
  return normalizeMvtTiles({
    tiles: [
      { tile: WEST, decoded: { ...west, layers: [...west.layers, ...westBuilding.layers, ...westPark.layers], layerCount: 3, featureCount: west.featureCount + westBuilding.featureCount + westPark.featureCount } },
      { tile: EAST, decoded: { ...east, layers: [...east.layers, ...eastBuilding.layers, ...eastPark.layers], layerCount: 3, featureCount: east.featureCount + eastBuilding.featureCount + eastPark.featureCount } },
    ],
    origin: ORIGIN,
    regionId: "seam",
  });
}

it("merges a road crossing the tile seam into one continuous centerline with a canonical id", () => {
  const normalized = normalizeWith({
    west: [lineFeature("transportation", 123, [[3000, 2048], [4600, 2048]])],
    east: [lineFeature("transportation", 123, [[-500, 2048], [1500, 2048]])],
  });
  const roads = normalized.region.roads.filter((road) => road.source?.sourceId === "123");
  expect(roads).toHaveLength(1);
  expect(roads[0].id).toBe("mvt:transportation:123#p0");
  // One merged centerline: west clip end, seam point, east clip start.
  const points = roads[0].centerline.points;
  expect(points).toHaveLength(3);
  const seamX = projector.project({ latitude: ORIGIN.latitude, longitude: SEAM_LON }).x;
  expect(points[0].x).toBeCloseTo(-300, 1);
  expect(points[1].x).toBeCloseTo(seamX, 1);
  expect(points[2].x).toBeCloseTo(300, 1);
  for (let i = 1; i < points.length; i += 1) expect(points[i].x).toBeGreaterThan(points[i - 1].x);
});

it("keeps both halves of a straddling building without overlapping area", () => {
  const normalized = normalizeWith({
    west: [polyFeature("building", 456, [[3000, 1898], [4600, 1898], [4600, 2198], [3000, 2198], [3000, 1898]])],
    east: [polyFeature("building", 456, [[-500, 1898], [500, 1898], [500, 2198], [-500, 2198], [-500, 1898]])],
  });
  const buildings = normalized.region.buildings.filter((building) => building.source?.sourceId === "456");
  expect(buildings).toHaveLength(2);
  expect(buildings.map((building) => building.id).sort()).toEqual(["mvt:building:456#h0", "mvt:building:456#h1"]);
  const areas = buildings.map((building) => areaOf(building.footprint));
  for (const area of areas) expect(area).toBeGreaterThan(0);
  // Region-clipped width (600 m) x 300 units of tile height: no overlap, no gap.
  const full = 600 * (300 * unitMetersY);
  expect(areas[0] + areas[1]).toBeGreaterThan(full * 0.95);
  expect(areas[0] + areas[1]).toBeLessThan(full * 1.05);
});

it("preserves a hole crossing the seam without duplicating the area", () => {
  const normalized = normalizeWith({
    west: [polyFeature("park", 999, [[3000, 1898], [4600, 1898], [4600, 2298], [3000, 2298], [3000, 1898]], [[[3900, 1948], [4300, 1948], [4300, 2148], [3900, 2148], [3900, 1948]]])],
    east: [polyFeature("park", 999, [[-500, 1898], [500, 1898], [500, 2298], [-500, 2298], [-500, 1898]], [[[-196, 1948], [204, 1948], [204, 2148], [-196, 2148], [-196, 1948]]])],
  });
  const parks = normalized.region.landAreas.filter((area) => area.source?.sourceId === "999");
  expect(parks).toHaveLength(2);
  for (const park of parks) expect(park.area.holes).toHaveLength(1);
  const netArea = parks.reduce((sum, park) => sum + areaOf(park.area), 0);
  const fullOuter = 600 * (400 * unitMetersY);
  const fullHole = (400 * unitMetersX) * (200 * unitMetersY);
  expect(netArea).toBeGreaterThan((fullOuter - fullHole) * 0.95);
  expect(netArea).toBeLessThan((fullOuter - fullHole) * 1.05);
});

it("drops the buffered copy of a building from the neighboring tile", () => {
  const normalized = normalizeWith({
    west: [polyFeature("building", 789, [[3500, 2000], [3700, 2000], [3700, 2200], [3500, 2200], [3500, 2000]])],
    // Same feature in the east tile's buffer strip: local coords shifted west.
    east: [polyFeature("building", 789, [[-596, 2000], [-396, 2000], [-396, 2200], [-596, 2200], [-596, 2000]])],
  });
  const buildings = normalized.region.buildings.filter((building) => building.source?.sourceId === "789");
  expect(buildings).toHaveLength(1);
});

it("is deterministic across runs", () => {
  const features = {
    west: [lineFeature("transportation", 123, [[3000, 2048], [4600, 2048]])],
    east: [lineFeature("transportation", 123, [[-500, 2048], [1500, 2048]])],
  };
  const first = normalizeWith(features);
  const second = normalizeWith(features);
  expect(second.region.roads.map((road) => road.id)).toEqual(first.region.roads.map((road) => road.id));
  expect(second.region.roads.map((road) => road.centerline.points)).toEqual(first.region.roads.map((road) => road.centerline.points));
});
