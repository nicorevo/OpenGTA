import { describe, expect, it } from "vitest";
import { createTangentProjector } from "../coordinates/projector.ts";
import { normalizeOsm } from "./osm.ts";

describe("OSM normalization", () => {
  it("maps bounded raw features and reports missing nodes", () => {
    const region = normalizeOsm({ elements: [
      { type: "node", id: 1, lat: 40.353, lon: 18.172 }, { type: "node", id: 2, lat: 40.353, lon: 18.173 }, { type: "node", id: 3, lat: 40.354, lon: 18.173 },
      { type: "way", id: 7, nodes: [1, 2, 3, 1], tags: { building: "house", height: "10 ft" } },
      { type: "way", id: 8, nodes: [1, 99], tags: { highway: "residential" } },
    ] }, createTangentProjector({ latitude: 40.35316888888889, longitude: 18.17259 }), { latitude: 40.35316888888889, longitude: 18.17259 });
    expect(region.buildings[0].sourceHeightMeters).toBeCloseTo(3.048);
    expect(region.buildings[0].collisionPolicy).toBe("solid");
    expect(region.warnings[0].code).toBe("missing-node");
  });

  it("reconstructs building multipolygons with inner courtyard rings", () => {
    const origin = { latitude: 40.35316888888889, longitude: 18.17259 };
    const region = normalizeOsm({ elements: [
      { type: "node", id: 1, lat: 40.353, lon: 18.172 }, { type: "node", id: 2, lat: 40.353, lon: 18.173 }, { type: "node", id: 3, lat: 40.354, lon: 18.173 }, { type: "node", id: 4, lat: 40.354, lon: 18.172 },
      { type: "node", id: 5, lat: 40.3533, lon: 18.1723 }, { type: "node", id: 6, lat: 40.3533, lon: 18.1727 }, { type: "node", id: 7, lat: 40.3537, lon: 18.1727 }, { type: "node", id: 8, lat: 40.3537, lon: 18.1723 },
      { type: "way", id: 10, nodes: [1, 2, 3, 4, 1] }, { type: "way", id: 11, nodes: [5, 6, 7, 8, 5] },
      { type: "relation", id: 20, members: [{ type: "way", ref: 10, role: "outer" }, { type: "way", ref: 11, role: "inner" }], tags: { building: "historic" } },
    ] }, createTangentProjector(origin), origin);
    expect(region.buildings).toHaveLength(1);
    expect(region.buildings[0].footprint.holes).toHaveLength(1);
  });
});
