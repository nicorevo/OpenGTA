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
    expect(chunk.collisions.every((shape) => shape.kind === "polygon")).toBe(true);
    expect(result.chunks[0]).toEqual(compileRegion(fixture as unknown as WorldRegion).chunks[0]);
  });
});
