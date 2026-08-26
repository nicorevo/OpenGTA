import { describe, expect, it } from "vitest";
import rawFixture from "../../fixtures/geo/lecce-sant-oronzo-v0.raw.json";
import { createTangentProjector } from "../coordinates/projector.ts";
import { normalizeOsm } from "./osm.ts";
import { compileRegion } from "../../world/compiler/compiled.ts";

describe("committed Lecce fixture", () => {
  it("normalizes and compiles without network access", () => {
    const origin = { latitude: 40.35316888888889, longitude: 18.17259 };
    const region = normalizeOsm(rawFixture, createTangentProjector(origin), origin, "lecce-sant-oronzo-v0");
    const result = compileRegion(region);
    expect(region.buildings.length).toBeGreaterThan(0);
    expect(region.roads.length).toBeGreaterThan(0);
    expect(result.chunks[0].buildings.length).toBeGreaterThan(0);
    expect(result.chunks[0].roads.length).toBeGreaterThan(0);
    expect(region.buildings.find((building) => building.id === "osm:relation:3985208")?.footprint.outer).toHaveLength(37);
  });
});
