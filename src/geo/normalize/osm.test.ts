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
});
