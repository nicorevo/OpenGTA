import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decodeVectorTile, type DecodedVectorTile } from "./decode.ts";
import { latLonToTile } from "./math.ts";

// Committed real tile: OpenFreeMap planet 20260830_080001_pt, z14/x9019/y6181.
const FIXTURE_PATH = fileURLToPath(new URL("../../fixtures/geo/lecce-z14-openfreemap.pbf", import.meta.url));
const LECCE = { latitude: 40.35316888888889, longitude: 18.17259 };

function loadFixture(): Uint8Array {
  return new Uint8Array(readFileSync(FIXTURE_PATH));
}

function collectNumbers(value: unknown, out: number[] = []): number[] {
  if (typeof value === "number") out.push(value);
  else if (Array.isArray(value)) for (const entry of value) collectNumbers(entry, out);
  else if (value !== null && typeof value === "object") for (const entry of Object.values(value)) collectNumbers(entry, out);
  return out;
}

function layerNamed(tile: DecodedVectorTile, name: string) {
  const layer = tile.layers.find((candidate) => candidate.name === name);
  if (!layer) throw new Error(`missing layer ${name}`);
  return layer;
}

describe("real OpenFreeMap tile fixture", () => {
  it("is the tile that contains Lecce", () => {
    const bytes = loadFixture();
    expect(bytes.byteLength).toBe(321055);
    expect(latLonToTile(LECCE.latitude, LECCE.longitude, 14)).toEqual({ z: 14, x: 9019, y: 6181 });
  });

  it("decodes the committed tile into readable layers", () => {
    const tile = decodeVectorTile(loadFixture());
    expect(tile.byteLength).toBe(321055);
    expect(tile.layers.map((layer) => layer.name)).toEqual([
      "building",
      "housenumber",
      "landcover",
      "landuse",
      "mountain_peak",
      "park",
      "place",
      "poi",
      "transportation",
      "transportation_name",
      "water",
    ]);
    expect(tile.layerCount).toBe(11);
    expect(tile.featureCount).toBe(4623);
    for (const layer of tile.layers) {
      expect(layer.version).toBe(2);
      expect(layer.extent).toBe(4096);
    }
  });

  it("exposes the building layer with polygon features and numeric heights", () => {
    const building = layerNamed(decodeVectorTile(loadFixture()), "building");
    expect(building.features).toHaveLength(30);
    for (const feature of building.features) {
      expect(feature.geometry.type).toBe("polygon");
      expect(Number.isFinite(feature.properties.render_height)).toBe(true);
    }
    expect(building.features[0].properties).toEqual({ render_height: 4, render_min_height: 0 });
    expect(building.features[1].properties).toEqual({ render_height: 5, render_min_height: 0 });
  });

  it("exposes the transportation layer with line and polygon features", () => {
    const transportation = layerNamed(decodeVectorTile(loadFixture()), "transportation");
    expect(transportation.features).toHaveLength(585);
    const counts = new Map<string, number>();
    let lines = 0;
    let polygons = 0;
    for (const feature of transportation.features) {
      if (feature.geometry.type === "line") lines += 1;
      if (feature.geometry.type === "polygon") polygons += 1;
      const roadClass = feature.properties.class;
      if (typeof roadClass === "string") counts.set(roadClass, (counts.get(roadClass) ?? 0) + 1);
    }
    expect(lines).toBe(544);
    expect(polygons).toBe(41);
    expect(Object.fromEntries(counts)).toEqual({
      path: 76,
      bridge: 1,
      service: 33,
      minor: 365,
      primary: 26,
      tertiary: 63,
      track: 1,
      trunk: 1,
      secondary: 19,
    });
  });

  it("decodes closed rings, holes and buffered coordinates", () => {
    const transportation = layerNamed(decodeVectorTile(loadFixture()), "transportation");
    let holes = 0;
    let buffered = 0;
    for (const layer of decodeVectorTile(loadFixture()).layers) {
      for (const feature of layer.features) {
        if (feature.geometry.type !== "polygon") continue;
        for (const polygon of feature.geometry.polygons) {
          for (const ring of [polygon.exterior, ...polygon.holes]) {
            expect(ring.length).toBeGreaterThanOrEqual(4);
            expect(ring[0]).toEqual(ring[ring.length - 1]);
            for (const point of ring) {
              if (point.x < 0 || point.y < 0 || point.x > 4096 || point.y > 4096) buffered += 1;
            }
          }
          holes += polygon.holes.length;
        }
      }
    }
    expect(transportation.features[0].geometry.type).toBe("polygon");
    // Winding of the pinned dataset: 3975 rings of which 538 are interior rings.
    expect(holes).toBe(538);
    expect(buffered).toBeGreaterThan(0);
  });

  it("keeps every decoded number finite and every geometry point integral", () => {
    const tile = decodeVectorTile(loadFixture());
    for (const value of collectNumbers(tile)) {
      expect(Number.isFinite(value)).toBe(true);
    }
    for (const layer of tile.layers) {
      expect(layer.features.length).toBeLessThanOrEqual(10_000);
      for (const feature of layer.features) {
        expect(Object.keys(feature.properties).length).toBeLessThanOrEqual(256);
        const points =
          feature.geometry.type === "point"
            ? feature.geometry.points
            : feature.geometry.type === "line"
              ? feature.geometry.lines.flat()
              : feature.geometry.polygons.flatMap((polygon) => [polygon.exterior, ...polygon.holes]).flat();
        expect(points.length).toBeLessThanOrEqual(50_000);
        for (const point of points) {
          expect(Number.isInteger(point.x)).toBe(true);
          expect(Number.isInteger(point.y)).toBe(true);
        }
      }
    }
  });

  it("decodes the same bytes deterministically", () => {
    const first = decodeVectorTile(loadFixture());
    const second = decodeVectorTile(loadFixture());
    expect(second.layers.map((layer) => layer.features.length)).toEqual(first.layers.map((layer) => layer.features.length));
    expect(second.layers.map((layer) => layer.features[0])).toEqual(first.layers.map((layer) => layer.features[0]));
  });

  it("decodes the fixture under an abort signal that never fires", () => {
    const controller = new AbortController();
    const tile = decodeVectorTile(loadFixture(), { signal: controller.signal });
    expect(tile.featureCount).toBe(4623);
  });
});
