import { describe, expect, it } from "vitest";
import fixture from "../../../docs/fixtures/synthetic/canonical-mini-city.v0.json";
import { compileRegion } from "./compiled.ts";
import type { WorldRegion } from "../model/types.ts";

const roadRegion = (points: readonly { x: number; y: number }[], roadClass: "residential" | "primary", widthMeters?: number): WorldRegion => ({
  id: "roads",
  geoOrigin: { latitude: 0, longitude: 0 },
  bounds: { minX: -50, minY: -50, maxX: 50, maxY: 50 },
  buildings: [],
  roads: [{ id: "road:1", kind: "road", centerline: { points }, roadClass, widthMeters }],
  landAreas: [],
  waterAreas: [],
  barriers: [],
  trees: [],
  warnings: [],
});

describe("V0 world compiler", () => {
  it("preserves buildings, holes and planar collision semantics", () => {
    const result = compileRegion(fixture as unknown as WorldRegion);
    const chunk = result.chunks[0];
    expect(chunk.buildings).toHaveLength(4);
    expect(chunk.buildings.find((building) => building.featureId.endsWith("building:b"))?.roof.holes).toHaveLength(1);
    expect(chunk.roads).toHaveLength(2);
    expect(chunk.labels).toHaveLength(0);
    expect(chunk.collisions.every((shape) => shape.kind === "polygon")).toBe(true);
    const other = compileRegion(fixture as unknown as WorldRegion).chunks[0];
    // Timing is volatile by definition: determinism compares the rest, and the
    // real-duration contract is asserted separately.
    const withoutTiming = (value: typeof chunk) => ({ ...value, diagnostics: { ...value.diagnostics, stageDurationsMs: {} } });
    expect(withoutTiming(result.chunks[0])).toEqual(withoutTiming(other));
    expect(chunk.diagnostics.stageDurationsMs.compile).toBeGreaterThan(0);
  });

  it("exposes a renderer-neutral centerline and width for each road", () => {
    const chunk = compileRegion(roadRegion([{ x: -10, y: 0 }, { x: 10, y: 0 }], "residential")).chunks[0];
    expect(chunk.roads[0].centerline).toEqual([{ x: -10, y: 0 }, { x: 10, y: 0 }]);
    expect(chunk.roads[0].widthMeters).toBe(6);
  });

  it("closes the road strip with bevel joins at bends instead of detached segment quads", () => {
    const chunk = compileRegion(roadRegion([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], "residential", 4)).chunks[0];
    expect(chunk.roads[0].surface.outer).toEqual([
      { x: 0, y: 2 },
      { x: 10, y: 2 },
      { x: 8, y: 0 },
      { x: 8, y: 10 },
      { x: 12, y: 10 },
      { x: 12, y: 0 },
      { x: 10, y: -2 },
      { x: 0, y: -2 },
    ]);
  });

  it("does not duplicate offsets on straight centerlines", () => {
    const chunk = compileRegion(roadRegion([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }], "residential", 4)).chunks[0];
    expect(chunk.roads[0].surface.outer).toHaveLength(6);
  });

  it("compiles named roads into prioritized labels", () => {
    const region: WorldRegion = { id: "labels", geoOrigin: { latitude: 0, longitude: 0 }, bounds: { minX: -20, minY: -20, maxX: 20, maxY: 20 }, buildings: [], roads: [{ id: "road:1", kind: "road", centerline: { points: [{ x: -10, y: 0 }, { x: 10, y: 0 }] }, roadClass: "primary", tags: { name: "Via Test" } }], landAreas: [], waterAreas: [], barriers: [], trees: [], warnings: [] };
    expect(compileRegion(region).chunks[0].labels).toEqual([{ featureId: "road:1", text: "Via Test", position: { x: 0, y: 0 }, angle: 0, kind: "road", priority: 90 }]);
  });

  it("compiles named water areas and rivers into labels and skips nameless water", () => {
    const region: WorldRegion = { id: "water-labels", geoOrigin: { latitude: 0, longitude: 0 }, bounds: { minX: -20, minY: -20, maxX: 20, maxY: 20 }, buildings: [], roads: [], landAreas: [], waterAreas: [{ id: "water:1", kind: "water", area: { outer: [{ x: -10, y: -10 }, { x: 10, y: -10 }, { x: 10, y: 10 }, { x: -10, y: 10 }], holes: [] }, tags: { name: "Lago Test" } }, { id: "water:2", kind: "water", line: { points: [{ x: -10, y: 0 }, { x: 10, y: 0 }] }, tags: { name: "Fiume Test" } }, { id: "water:3", kind: "water", line: { points: [{ x: -5, y: 5 }, { x: 5, y: 5 }] } }], barriers: [], trees: [], warnings: [] };
    expect(compileRegion(region).chunks[0].labels).toEqual([
      { featureId: "water:2", text: "Fiume Test", position: { x: 0, y: 0 }, angle: 0, kind: "place", priority: 105 },
      { featureId: "water:1", text: "Lago Test", position: { x: 0, y: 0 }, angle: 0, kind: "place", priority: 105 },
    ]);
  });

  it("uses the documented 9 m fallback for building height", () => {
    const region: WorldRegion = {
      id: "height-fallback",
      geoOrigin: { latitude: 0, longitude: 0 },
      bounds: { minX: -20, minY: -20, maxX: 20, maxY: 20 },
      buildings: [{
        id: "building:1",
        kind: "building",
        footprint: { outer: [{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }], holes: [] },
        buildingType: "unknown",
        collisionPolicy: "solid",
      }],
      roads: [],
      landAreas: [],
      waterAreas: [],
      barriers: [],
      trees: [],
      warnings: [],
    };
    expect(compileRegion(region).chunks[0].buildings[0]?.visualHeightMeters).toBe(9);
  });

  it("compiles solid barriers and accounts for unsupported trees", () => {
    const region: WorldRegion = {
      id: "barriers",
      geoOrigin: { latitude: 0, longitude: 0 },
      bounds: { minX: -20, minY: -20, maxX: 20, maxY: 20 },
      buildings: [],
      roads: [],
      landAreas: [],
      waterAreas: [],
      barriers: [{
        id: "barrier:1",
        kind: "barrier",
        geometry: { points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }] },
        collisionPolicy: "solid",
      }],
      trees: [{ id: "tree:1", kind: "tree", position: { x: 1, y: 1 } }],
      warnings: [],
    };

    const chunk = compileRegion(region).chunks[0];

    expect(chunk.collisions.filter((shape) => shape.kind === "segment")).toHaveLength(2);
    expect(chunk.diagnostics).toMatchObject({
      inputFeatureCount: 2,
      compiledFeatureCount: 1,
      skippedFeatureCount: 1,
    });
  });

  it("compiles water areas into ground visuals", () => {
    const region: WorldRegion = {
      id: "water",
      geoOrigin: { latitude: 0, longitude: 0 },
      bounds: { minX: -20, minY: -20, maxX: 20, maxY: 20 },
      buildings: [],
      roads: [],
      landAreas: [],
      waterAreas: [{
        id: "water:1",
        kind: "water",
        area: { outer: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }], holes: [] },
        waterClass: "basin",
      }],
      barriers: [],
      trees: [],
      warnings: [],
    };

    expect(compileRegion(region).chunks[0].ground).toEqual([{
      featureId: "water:1",
      area: region.waterAreas[0].area,
      styleKey: "water:basin",
    }]);
  });

  it("warns when unknown building collision defaults to solid", () => {
    const region: WorldRegion = {
      id: "unknown-collision",
      geoOrigin: { latitude: 0, longitude: 0 },
      bounds: { minX: -20, minY: -20, maxX: 20, maxY: 20 },
      buildings: [{
        id: "building:1",
        kind: "building",
        footprint: { outer: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }], holes: [] },
        buildingType: "unknown",
        collisionPolicy: "unknown",
      }],
      roads: [],
      landAreas: [],
      waterAreas: [],
      barriers: [],
      trees: [],
      warnings: [],
    };

    const chunk = compileRegion(region).chunks[0];

    expect(chunk.collisions).toHaveLength(1);
    expect(chunk.diagnostics.warnings[0]).toContain("unknown collision policy");
  });
});

describe("V0 compiler timing diagnostics", () => {
  it("reports real stage durations instead of a fixed total", () => {
    const result = compileRegion(fixture as unknown as WorldRegion);
    const { stageDurationsMs } = result.chunks[0].diagnostics;
    expect(stageDurationsMs.compile).toBeGreaterThan(0);
    expect(stageDurationsMs.total).toBeGreaterThanOrEqual(stageDurationsMs.compile ?? 0);
  });
});

describe("V0 compiler cancellation", () => {
  it("aborts compilation when the signal is already cancelled", () => {
    const region: WorldRegion = { id: "abort", geoOrigin: { latitude: 0, longitude: 0 }, bounds: { minX: -50, minY: -50, maxX: 50, maxY: 50 }, buildings: [{ id: "b", kind: "building", footprint: { outer: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }], holes: [] }, buildingType: "residential", collisionPolicy: "solid" }], roads: [], landAreas: [], waterAreas: [], barriers: [], trees: [], warnings: [] };
    const controller = new AbortController();
    controller.abort();
    expect(() => compileRegion(region, { signal: controller.signal })).toThrow(/abort/i);
  });
});
