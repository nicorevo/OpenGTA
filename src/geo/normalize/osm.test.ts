import { describe, expect, it } from "vitest";
import { createTangentProjector, type GeoProjector } from "../coordinates/projector.ts";
import { normalizeOsm, type RawOsm } from "./osm.ts";

const origin = { latitude: 40.35316888888889, longitude: 18.17259 };
const projector = createTangentProjector(origin);
const identityProjector: GeoProjector = {
  project: ({ latitude, longitude }) => ({ x: longitude, y: latitude }),
  unproject: ({ x, y }) => ({ latitude: y, longitude: x }),
};

describe("OSM normalization", () => {
  it("maps bounded raw features and reports missing nodes", () => {
    const region = normalizeOsm({ elements: [
      { type: "node", id: 1, lat: 40.353, lon: 18.172 },
      { type: "node", id: 2, lat: 40.353, lon: 18.173 },
      { type: "node", id: 3, lat: 40.354, lon: 18.173 },
      { type: "way", id: 7, nodes: [1, 2, 3, 1], tags: { building: "house", height: "10 ft" } },
      { type: "way", id: 8, nodes: [1, 99], tags: { highway: "residential" } },
    ] }, projector, origin);

    expect(region.buildings[0].sourceHeightMeters).toBeCloseTo(3.048);
    expect(region.buildings[0].collisionPolicy).toBe("solid");
    expect(region.warnings[0].code).toBe("missing-node");
  });

  it("joins multiple outer ways into one multipolygon ring", () => {
    const raw: RawOsm = { elements: [
      { type: "node", id: 1, lat: 0, lon: 0 },
      { type: "node", id: 2, lat: 0, lon: 10 },
      { type: "node", id: 3, lat: 10, lon: 10 },
      { type: "node", id: 4, lat: 10, lon: 0 },
      { type: "way", id: 10, nodes: [1, 2, 3] },
      { type: "way", id: 11, nodes: [3, 4, 1] },
      { type: "relation", id: 20, members: [
        { type: "way", ref: 10, role: "outer" },
        { type: "way", ref: 11, role: "outer" },
      ], tags: { building: "historic" } },
    ] };

    const region = normalizeOsm(raw, identityProjector, origin);

    expect(region.buildings).toHaveLength(1);
    expect(region.buildings[0].footprint.outer).toHaveLength(4);
    expect(region.buildings[0].footprint.holes).toHaveLength(0);
    expect(region.warnings).toHaveLength(0);
  });

  it("reconstructs building multipolygons with inner courtyard rings", () => {
    const region = normalizeOsm({ elements: [
      { type: "node", id: 1, lat: 40.353, lon: 18.172 },
      { type: "node", id: 2, lat: 40.353, lon: 18.173 },
      { type: "node", id: 3, lat: 40.354, lon: 18.173 },
      { type: "node", id: 4, lat: 40.354, lon: 18.172 },
      { type: "node", id: 5, lat: 40.3533, lon: 18.1723 },
      { type: "node", id: 6, lat: 40.3533, lon: 18.1727 },
      { type: "node", id: 7, lat: 40.3537, lon: 18.1727 },
      { type: "node", id: 8, lat: 40.3537, lon: 18.1723 },
      { type: "way", id: 10, nodes: [1, 2, 3, 4, 1] },
      { type: "way", id: 11, nodes: [5, 6, 7, 8, 5] },
      { type: "relation", id: 20, members: [
        { type: "way", ref: 10, role: "outer" },
        { type: "way", ref: 11, role: "inner" },
      ], tags: { building: "historic" } },
    ] }, projector, origin);

    expect(region.buildings).toHaveLength(1);
    expect(region.buildings[0].footprint.holes).toHaveLength(1);
  });

  it("rejects open and degenerate standalone building ways", () => {
    const region = normalizeOsm({ elements: [
      { type: "node", id: 1, lat: 0, lon: 0 },
      { type: "node", id: 2, lat: 0, lon: 10 },
      { type: "node", id: 3, lat: 10, lon: 10 },
      { type: "way", id: 10, nodes: [1, 2, 3], tags: { building: "yes" } },
      { type: "way", id: 11, nodes: [1, 2, 2, 1], tags: { building: "yes" } },
    ] }, identityProjector, origin);

    expect(region.buildings).toHaveLength(0);
    expect(region.warnings.map((entry) => entry.code)).toEqual([
      "invalid-building",
      "invalid-building",
    ]);
  });

  it("warns for malformed measures without deriving values", () => {
    const region = normalizeOsm({ elements: [
      { type: "node", id: 1, lat: 0, lon: 0 },
      { type: "node", id: 2, lat: 0, lon: 10 },
      { type: "node", id: 3, lat: 10, lon: 10 },
      { type: "way", id: 10, nodes: [1, 2, 3, 1], tags: { building: "yes", height: "12;14" } },
    ] }, identityProjector, origin);

    expect(region.buildings[0].sourceHeightMeters).toBeUndefined();
    expect(region.warnings.map((entry) => entry.code)).toContain("invalid-measure");
  });

  it("preserves road and selected barrier semantics", () => {
    const region = normalizeOsm({ elements: [
      { type: "node", id: 1, lat: 0, lon: 0 },
      { type: "node", id: 2, lat: 0, lon: 10 },
      { type: "way", id: 10, nodes: [1, 2], tags: {
        highway: "service",
        service: "parking_aisle",
        bridge: "yes",
        tunnel: "no",
        layer: "-1",
      } },
      { type: "way", id: 11, nodes: [1, 2], tags: { barrier: "fence" } },
      { type: "way", id: 12, nodes: [1, 2], tags: { waterway: "stream" } },
    ] }, identityProjector, origin);

    expect(region.roads[0]).toMatchObject({
      roadClass: "parking-aisle",
      bridge: true,
      tunnel: false,
      layerHint: -1,
    });
    expect(region.barriers[0]).toMatchObject({ barrierType: "fence", collisionPolicy: "solid" });
    expect(region.waterAreas[0]).toMatchObject({ waterClass: "stream" });
    expect(region.waterAreas[0].line?.points).toHaveLength(2);
  });

  it("skips invalid source coordinates with a diagnostic", () => {
    const region = normalizeOsm({ elements: [
      { type: "node", id: 1, lat: Number.NaN, lon: 0 },
      { type: "node", id: 2, lat: 0, lon: 10 },
      { type: "way", id: 10, nodes: [1, 2], tags: { highway: "residential" } },
    ] }, identityProjector, origin);

    expect(region.roads).toHaveLength(0);
    expect(region.warnings.map((entry) => entry.code)).toContain("invalid-node");
  });
});

describe("OSM normalization cancellation", () => {
  const ringRaw = (ways: number): RawOsm => {
    const elements: RawOsm["elements"][number][] = [];
    for (let i = 1; i <= ways * 2; i += 1) elements.push({ type: "node", id: i, lat: 40.35 + (i % 2), lon: 18.17 + (i % 3) });
    const memberWays = [];
    for (let w = 0; w < ways; w += 1) {
      const a = w * 2 + 1; const b = a + 1; const c = ((w + 1) * 2) % (ways * 2) + 1;
      elements.push({ type: "way", id: 1000 + w, nodes: [a, b, c], tags: {} });
      memberWays.push({ type: "way", ref: 1000 + w, role: "outer" });
    }
    elements.push({ type: "relation", id: 5000, members: memberWays, tags: { type: "multipolygon", landuse: "grass" } });
    return { elements };
  };

  it("aborts a large multipolygon assembly when the signal is cancelled", () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => normalizeOsm(ringRaw(500), identityProjector, origin, "abort-test", { signal: controller.signal })).toThrow(/abort/i);
  });

  it("aborts the element partition loop with a cancelled signal", () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => normalizeOsm({ elements: Array.from({ length: 600 }, (_, i) => ({ type: "node" as const, id: i, lat: 0, lon: 0 })) }, identityProjector, origin, "abort-test", { signal: controller.signal })).toThrow(/abort/i);
  });
});
