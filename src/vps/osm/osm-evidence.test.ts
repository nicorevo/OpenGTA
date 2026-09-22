import { describe, it, expect } from "vitest";
import { collectOsmEvidence, DENSITY_SATURATION } from "./osm-evidence.ts";
import type { OsmArea, OsmCellFeatures, OsmNode, OsmWay } from "./types.ts";
import { cellForCoordinates } from "../cell/cell.ts";
import { createProfileCompiler, COMPILER_REVISION } from "../compiler/compiler.ts";
import { defaultCatalog } from "../catalog/catalog.ts";
import { romeProfile } from "../../render/theme/profiles/rome.ts";
import type { Distribution } from "../evidence/types.ts";

const CELL = cellForCoordinates(41.8992, 12.4769);
const RETRIEVED_AT = "2026-09-21T00:00:00Z";

const area = (areaM2: number, tags: Record<string, string> = {}): OsmArea => ({ areaM2, tags });
const way = (lengthM: number, tags: Record<string, string> = {}): OsmWay => ({ lengthM, tags });
const node = (tags: Record<string, string> = {}): OsmNode => ({ tags });

/** A plausible dense-European cell: tagged buildings, paved roads, some green. */
function romeLikeFeatures(): OsmCellFeatures {
  const areas: OsmArea[] = [];
  // roof weights: tiles (12+8) x 1200 = 24000 vs flat 3 x 2000 = 6000 -> 0.8 / 0.2
  for (let i = 0; i < 12; i += 1) areas.push(area(1200, { building: "yes", "roof:material": "roof_tiles", "building:colour": "ochre" }));
  for (let i = 0; i < 8; i += 1) areas.push(area(1200, { building: "yes", "roof:material": "roof_tiles", "building:material": "brick", "building:colour": "yellow" }));
  for (let i = 0; i < 3; i += 1) areas.push(area(2000, { building: "yes", "roof:shape": "flat" }));
  for (let i = 0; i < 4; i += 1) areas.push(area(900, { building: "yes" })); // untagged: typical sparse OSM
  // green: ~4% of the cell (cell is ~154k m2)
  areas.push(area(3000, { landuse: "grass" }));
  areas.push(area(2500, { natural: "wood" }));
  areas.push(area(1200, { leisure: "park" }));

  const ways: OsmWay[] = [];
  for (let i = 0; i < 8; i += 1) ways.push(way(400, { highway: "residential", surface: "cobblestone" }));
  for (let i = 0; i < 6; i += 1) ways.push(way(400, { highway: "residential", surface: "asphalt" }));
  for (let i = 0; i < 5; i += 1) ways.push(way(200, { highway: "footway", surface: "paving_stones" }));
  for (let i = 0; i < 6; i += 1) ways.push(way(300, { highway: "residential" })); // untagged roads
  ways.push(way(300, { highway: "residential", lighting: "street" }));
  ways.push(way(200, { highway: "residential", parking: "lane" }));

  const nodes: OsmNode[] = [];
  for (let i = 0; i < 25; i += 1) nodes.push(node({ natural: "tree" }));
  for (let i = 0; i < 3; i += 1) nodes.push(node({ amenity: "bench" }));
  for (let i = 0; i < 8; i += 1) nodes.push(node({ barrier: "bollard" }));

  return { ways, areas, nodes };
}

describe("collectOsmEvidence (VPS-05, spec 7/40/41/101)", () => {
  it("empty cell: no observation at all -> zero confidence everywhere", () => {
    const evidence = collectOsmEvidence({ ways: [], areas: [], nodes: [] }, CELL, RETRIEVED_AT);
    const confidences = [
      evidence.facadeColors,
      evidence.facadeMaterials,
      evidence.roofTypes,
      evidence.sidewalkTypes,
      evidence.roadSurfaces,
      evidence.vegetation,
      evidence.urbanCharacter,
      evidence.streetFurniture,
    ].map((d) => d.confidence);
    expect(confidences).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(evidence.coverage.requestedSamples).toBe(0);
    expect(evidence.coverage.osmConfidence).toBe(0);
    expect(evidence.provenanceSummary.providers).toEqual(["osm"]);
    expect(evidence.evidenceRevision).toMatch(/^osm:v1:[0-9a-f]{8}$/);
  });

  it("explicit tags produce the expected dominant classes (spec 41: roof_tiles -> terracotta)", () => {
    const evidence = collectOsmEvidence(romeLikeFeatures(), CELL, RETRIEVED_AT);
    expect(evidence.roofTypes.dominant).toBe("terracotta-tile");
    expect(evidence.facadeColors.dominant).toBe("ochre");
    expect(evidence.facadeMaterials.dominant).toBe("brick");
    expect(evidence.roadSurfaces.dominant).toBe("cobblestone");
    expect(evidence.sidewalkTypes.dominant).toBe("pavers");
    expect(evidence.vegetation.dominant).toBeUndefined(); // OSM never asserts climate character
    expect(evidence.urbanCharacter.confidence).toBe(0); // OSM never asserts historic/modern
    expect(evidence.streetFurniture.confidence).toBe(0); // OSM counts, it does not characterize
  });

  it("scores are normalized over the classified features, weighted by geometry", () => {
    const evidence = collectOsmEvidence(romeLikeFeatures(), CELL, RETRIEVED_AT);
    const sum = Object.values(evidence.roofTypes.scores).reduce((s, v) => s + (v ?? 0), 0);
    expect(sum).toBeCloseTo(1, 5);
    // 20 tagged buildings of 1200 m2 (tiles) vs 3 of 2000 m2 (flat):
    // tiles weight = 20*1200 = 24000, flat = 6000 -> 0.8 / 0.2
    expect(evidence.roofTypes.scores["terracotta-tile"]).toBeCloseTo(0.8, 5);
    expect(evidence.roofTypes.scores["flat-concrete"]).toBeCloseTo(0.2, 5);
    // confidence = classified/observed = 23/27 buildings (round4 in the collector)
    expect(evidence.roofTypes.confidence).toBeCloseTo(23 / 27, 3);
  });

  it("surface=sett (live Rome sampietrini tag, VPS-10) classifies as cobblestone", () => {
    const features: OsmCellFeatures = {
      areas: [],
      ways: [way(400, { highway: "residential", surface: "sett" })],
      nodes: [],
    };
    const evidence = collectOsmEvidence(features, CELL, RETRIEVED_AT);
    expect(evidence.roadSurfaces.dominant).toBe("cobblestone");
    expect(evidence.roadSurfaces.scores["cobblestone"]).toBeCloseTo(1, 5);
    expect(evidence.roadSurfaces.confidence).toBeCloseTo(1, 5);
  });

  it("untagged OSM gets no high priority (spec 40): confidence stays below the compiler threshold", () => {
    const features: OsmCellFeatures = {
      areas: [area(1000, { building: "yes" }), area(1000, { building: "yes" }), area(900, { building: "yes" })],
      ways: [way(300, { highway: "residential" }), way(300, { highway: "residential" })],
      nodes: [],
    };
    const evidence = collectOsmEvidence(features, CELL, RETRIEVED_AT);
    expect(evidence.roofTypes.confidence).toBe(0);
    expect(evidence.roadSurfaces.confidence).toBe(0);
    expect(evidence.facadeMaterials.confidence).toBe(0);
    // but the absence of green is still observed
    expect(evidence.vegetation.dominant).toBe("sparse");
  });

  it("green presence above the sparseness threshold suppresses the sparse claim", () => {
    const sparse: OsmCellFeatures = {
      areas: [area(1000, { building: "yes" }), area(100, { natural: "grass" })],
      ways: [way(300, { highway: "residential" })],
      nodes: [],
    };
    const dense: OsmCellFeatures = {
      areas: [area(1000, { building: "yes" }), area(15000, { landuse: "grass" })],
      ways: [way(300, { highway: "residential" })],
      nodes: [],
    };
    expect(collectOsmEvidence(sparse, CELL, RETRIEVED_AT).vegetation.dominant).toBe("sparse");
    expect(collectOsmEvidence(dense, CELL, RETRIEVED_AT).vegetation.dominant).toBeUndefined();
  });

  it("counts feed the observedDensities with saturation (spec 92-93)", () => {
    const evidence = collectOsmEvidence(romeLikeFeatures(), CELL, RETRIEVED_AT);
    const expected = (count: number) => Math.round((1 - Math.exp(-count / DENSITY_SATURATION)) * 10000) / 10000;
    expect(evidence.observedDensities.tree).toBe(expected(25));
    expect(evidence.observedDensities.bench).toBe(expected(3));
    expect(evidence.observedDensities.bollard).toBe(expected(8));
    expect(evidence.observedDensities.streetLight).toBe(expected(1));
    expect(evidence.observedDensities.parkedVehicle).toBe(expected(1));
    // saturation is bounded
    const huge: OsmCellFeatures = { ways: [], areas: [], nodes: Array.from({ length: 500 }, () => node({ natural: "tree" })) };
    expect(collectOsmEvidence(huge, CELL, RETRIEVED_AT).observedDensities.tree).toBeLessThanOrEqual(1);
  });

  it("is deterministic and the revision tracks the input (spec 57/116/117)", () => {
    const features = romeLikeFeatures();
    const a = collectOsmEvidence(features, CELL, RETRIEVED_AT);
    const b = collectOsmEvidence(romeLikeFeatures(), CELL, RETRIEVED_AT);
    expect(b).toEqual(a);
    expect(b.evidenceRevision).toBe(a.evidenceRevision);
    const changed: OsmCellFeatures = {
      ...features,
      areas: features.areas.map((f, i) => (i === 0 ? area(f.areaM2, { ...f.tags, "roof:material": "metal" }) : f)),
    };
    expect(collectOsmEvidence(changed, CELL, RETRIEVED_AT).evidenceRevision).not.toBe(a.evidenceRevision);
  });

  it("coverage reports samples, spatial extent and the OSM-only confidences (spec 39)", () => {
    const evidence = collectOsmEvidence(romeLikeFeatures(), CELL, RETRIEVED_AT);
    expect(evidence.coverage.requestedSamples).toBe(romeLikeFeatures().ways.length + romeLikeFeatures().areas.length + romeLikeFeatures().nodes.length);
    expect(evidence.coverage.usableSamples).toBeGreaterThan(0);
    expect(evidence.coverage.usableSamples).toBeLessThanOrEqual(evidence.coverage.requestedSamples);
    expect(evidence.coverage.spatialCoverage).toBeGreaterThan(0);
    expect(evidence.coverage.spatialCoverage).toBeLessThanOrEqual(1);
    expect(evidence.coverage.directionalCoverage).toBe(0); // OSM has no camera direction
    expect(evidence.coverage.imageryConfidence).toBe(0); // no imagery in this collector
    expect(evidence.coverage.osmConfidence).toBeGreaterThan(0.5);
    expect(evidence.coverage.overall).toBeCloseTo(evidence.coverage.osmConfidence / 2, 3);
  });

  it("rejects untrusted geometry values at the boundary", () => {
    const bad = (features: OsmCellFeatures) => collectOsmEvidence(features, CELL, RETRIEVED_AT);
    expect(() => bad({ ways: [], areas: [area(-1)], nodes: [] })).toThrow(RangeError);
    expect(() => bad({ ways: [way(Number.NaN, { highway: "residential" })], areas: [], nodes: [] })).toThrow(RangeError);
    expect(() => bad({ ways: [], areas: [area(Number.POSITIVE_INFINITY)], nodes: [] })).toThrow(RangeError);
  });

  it("drives the compiler end to end: OSM roof_tiles -> terracotta urban family (spec 41)", () => {
    const compiler = createProfileCompiler();
    const evidence = collectOsmEvidence(romeLikeFeatures(), CELL, RETRIEVED_AT);
    const generated = compiler.compile(evidence, { parentProfile: romeProfile, catalog: defaultCatalog, compilerRevision: COMPILER_REVISION });
    expect(generated.identity.roofFamily).toBe("terracotta-urban");
    expect(generated.generation.cellId).toBe(CELL.id);
    expect(generated.generation.evidenceRevision).toBe(evidence.evidenceRevision);
  });

  it("untagged cells compile back to the parent (spec 42)", () => {
    const compiler = createProfileCompiler();
    const evidence = collectOsmEvidence(
      { areas: [area(1000, { building: "yes" })], ways: [way(300, { highway: "residential" })], nodes: [] },
      CELL,
      RETRIEVED_AT,
    );
    const generated = compiler.compile(evidence, { parentProfile: romeProfile, catalog: defaultCatalog, compilerRevision: COMPILER_REVISION });
    expect(generated.buildings.roofPalette).toEqual([...romeProfile.buildings.roofPalette]);
    expect(generated.buildings.facadePalette).toEqual([...romeProfile.buildings.facadePalette]);
  });
});
