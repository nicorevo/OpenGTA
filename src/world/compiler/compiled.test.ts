import { describe, expect, it } from "vitest";
import fixture from "../../../docs/fixtures/synthetic/canonical-mini-city.v0.json";
import { compileRegion } from "./compiled.ts";
import type { WorldRegion } from "../model/types.ts";

describe("V0 world compiler", () => {
  it("preserves buildings, holes and planar collision semantics", () => {
    const result = compileRegion(fixture as unknown as WorldRegion);
    const chunk = result.chunks[0];
    expect(chunk.buildings).toHaveLength(4);
    expect(chunk.buildings.find((building) => building.featureId.endsWith("building:b"))?.roof.holes).toHaveLength(1);
    expect(chunk.roads).toHaveLength(2);
    expect(chunk.labels).toHaveLength(0);
    expect(chunk.collisions.every((shape) => shape.kind === "polygon")).toBe(true);
    expect(result.chunks[0]).toEqual(compileRegion(fixture as unknown as WorldRegion).chunks[0]);
  });

  it("compiles named roads into prioritized labels", () => {
    const region: WorldRegion = { id: "labels", geoOrigin: { latitude: 0, longitude: 0 }, bounds: { minX: -20, minY: -20, maxX: 20, maxY: 20 }, buildings: [], roads: [{ id: "road:1", kind: "road", centerline: { points: [{ x: -10, y: 0 }, { x: 10, y: 0 }] }, roadClass: "primary", tags: { name: "Via Test" } }], landAreas: [], waterAreas: [], barriers: [], trees: [], warnings: [] };
    expect(compileRegion(region).chunks[0].labels).toEqual([{ featureId: "road:1", text: "Via Test", position: { x: 0, y: 0 }, angle: 0, kind: "road", priority: 90 }]);
  });
});
