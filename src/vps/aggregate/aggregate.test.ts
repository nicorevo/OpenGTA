import { describe, it, expect } from "vitest";
import { aggregateEvidence, createEvidenceAggregator, AGGREGATOR_REVISION } from "./aggregate.ts";
import type { AggregationInput, AggregatorOptions, AxisSourceTrust } from "./types.ts";
import {
  romeHistoricObservations,
  parisCentralObservations,
  tokyoDenseObservations,
} from "../analysis/fixtures/observations.ts";
import type { VisualObservation } from "../analysis/types.ts";
import type { StreetSample } from "../providers/street-imagery/types.ts";
import type { SpatialCell, VisualEvidenceProfile } from "../evidence/types.ts";

const CELL: SpatialCell = {
  id: "h3:891e8050527ffff",
  center: { latitude: 41.8992, longitude: 12.4769 },
  bounds: { south: 41.89, west: 12.46, north: 41.91, east: 12.50 },
  resolution: 9,
};
const RETRIEVED = "2026-09-21T00:00:00Z";

function sample(id: string, latOffsetM = 0, lonOffsetM = 0, heading?: number, detections?: string[]): StreetSample {
  return {
    provider: "test-imagery",
    sourceId: id,
    latitude: CELL.center.latitude + latOffsetM / 111_320,
    longitude: CELL.center.longitude + lonOffsetM / (111_320 * Math.cos((CELL.center.latitude * Math.PI) / 180)),
    capturedAt: "2026-01-15T09:00:00Z",
    heading,
    detections: detections?.map((tag) => ({ canonicalClass: tag, providerClass: tag, provenance: { provider: "test-imagery", sourceId: id, retrievedAt: RETRIEVED } })),
    provenance: { provider: "test-imagery", sourceId: id, capturedAt: "2026-01-15T09:00:00Z", retrievedAt: RETRIEVED },
  };
}

function input(overrides: Partial<AggregationInput> = {}): AggregationInput {
  return {
    cell: CELL,
    observations: romeHistoricObservations,
    samples: [sample("obs-rome-historic-1", 100, 100), sample("obs-rome-historic-2", -120, -100)],
    requestedSamples: 12,
    retrievedAt: RETRIEVED,
    ...overrides,
  };
}

/** Full OSM profile with zero/empty defaults; overrides for the cases below. */
function osmProfile(overrides: Partial<VisualEvidenceProfile> = {}): VisualEvidenceProfile {
  return {
    schemaVersion: 1,
    cell: CELL,
    evidenceRevision: "osm:v1:test0000",
    facadeColors: { scores: {}, confidence: 0 },
    facadeMaterials: { scores: {}, confidence: 0 },
    roofTypes: { scores: {}, confidence: 0 },
    sidewalkTypes: { scores: {}, confidence: 0 },
    roadSurfaces: { scores: {}, confidence: 0 },
    vegetation: { scores: {}, confidence: 0 },
    urbanCharacter: { scores: {}, confidence: 0 },
    streetFurniture: { scores: {}, confidence: 0 },
    observedDensities: { tree: 0, streetLight: 0, bench: 0, bollard: 0, parkedVehicle: 0 },
    coverage: { requestedSamples: 0, usableSamples: 0, spatialCoverage: 0, directionalCoverage: 0, imageryConfidence: 0, osmConfidence: 0, overall: 0 },
    provenanceSummary: { providers: ["osm"], sampleCount: 0, retrievedAt: RETRIEVED },
    ...overrides,
  };
}

describe("aggregateEvidence (VPS-08, spec 33-42, 104, 130)", () => {
  it("vision-only: dominants follow the observations, OSM fields stay empty (spec 42)", () => {
    const profile = aggregateEvidence(input({ observations: romeHistoricObservations, samples: [sample("obs-rome-historic-1", 100, 100), sample("obs-rome-historic-2", -120, -100)] }));
    expect(profile.facadeColors.dominant).toBe("ochre");
    expect(profile.roofTypes.dominant).toBe("terracotta-tile");
    expect(profile.roofTypes.scores["terracotta-tile"]).toBeCloseTo(1, 5); // both obs terracotta
    expect(profile.vegetation.dominant).toBe("mediterranean-urban");
    expect(profile.urbanCharacter.dominant).toBe("historic-dense");
    expect(profile.coverage.osmConfidence).toBe(0);
    expect(profile.coverage.overall).toBeCloseTo(profile.coverage.imageryConfidence, 5);
    expect(profile.provenanceSummary.providers).not.toContain("osm");
  });

  it("OSM-only: distributions and confidences pass through unchanged", () => {
    const osm = osmProfile({
      evidenceRevision: "osm:v1:abc12345",
      facadeColors: { scores: { ochre: 0.7, cream: 0.3 }, dominant: "ochre", confidence: 0.8 },
      facadeMaterials: { scores: { plaster: 1 }, dominant: "plaster", confidence: 0.6 },
      roofTypes: { scores: { "terracotta-tile": 1 }, dominant: "terracotta-tile", confidence: 0.9 },
      sidewalkTypes: { scores: { "warm-stone": 1 }, dominant: "warm-stone", confidence: 0.5 },
      roadSurfaces: { scores: { asphalt: 1 }, dominant: "asphalt", confidence: 0.7 },
      vegetation: { scores: { "mediterranean-urban": 1 }, dominant: "mediterranean-urban", confidence: 0.4 },
      urbanCharacter: { scores: { "historic-dense": 1 }, dominant: "historic-dense", confidence: 0.6 },
      observedDensities: { tree: 0.35, streetLight: 0.6, bench: 0.2, bollard: 0.15, parkedVehicle: 0.4 },
      coverage: { requestedSamples: 24, usableSamples: 18, spatialCoverage: 0.8, directionalCoverage: 0, imageryConfidence: 0, osmConfidence: 0.67, overall: 0.34 },
      provenanceSummary: { providers: ["osm"], sampleCount: 18, retrievedAt: RETRIEVED },
    });
    const profile = aggregateEvidence(input({ osmEvidence: osm, observations: [], samples: [] }));
    expect(profile.facadeColors.scores).toEqual({ ochre: 0.7, cream: 0.3 });
    expect(profile.facadeColors.confidence).toBeCloseTo(0.8, 5);
    expect(profile.roofTypes.confidence).toBeCloseTo(0.9, 5);
    expect(profile.streetFurniture.confidence).toBe(0);
    expect(profile.coverage.osmConfidence).toBeCloseTo(0.67, 5);
    expect(profile.provenanceSummary.providers).toContain("osm");
  });

  it("OSM explicit tag outranks vision (spec 40, 41): tagged roof keeps terracotta dominant", () => {
    const osm = osmProfile({
      roofTypes: { scores: { "terracotta-tile": 1 }, dominant: "terracotta-tile", confidence: 1.0 },
    });
    const vision: VisualObservation[] = [
      { sampleId: "v-1", roofType: { value: "flat-concrete", confidence: 0.9 }, quality: 0.9, provenance: sample("v-1").provenance },
      { sampleId: "v-2", roofType: { value: "flat-concrete", confidence: 0.85 }, quality: 0.9, provenance: sample("v-2").provenance },
    ];
    const profile = aggregateEvidence(input({ osmEvidence: osm, observations: vision, samples: [sample("v-1", 80, 80), sample("v-2", -80, -80)] }));
    expect(profile.roofTypes.dominant).toBe("terracotta-tile");
    // spec 130 trusts are 1.0 (OSM) vs 0.8 (vision): with both sources fully
    // confident the explicit tag lands strictly above the 50% line
    expect(profile.roofTypes.scores["terracotta-tile"]!).toBeGreaterThan(0.5);
    expect(profile.roofTypes.scores["terracotta-tile"]!).toBeGreaterThan(profile.roofTypes.scores["flat-concrete"]!);
  });

  it("untagged OSM (confidence 0) never outranks vision (spec 40)", () => {
    const osmEmpty = osmProfile({
      evidenceRevision: "osm:v1:empty000",
      observedDensities: { tree: 0.1, streetLight: 0, bench: 0, bollard: 0, parkedVehicle: 0 },
    });
    const profile = aggregateEvidence(input({ osmEvidence: osmEmpty }));
    expect(profile.facadeColors.dominant).toBe("ochre"); // from rome observations
    expect(profile.coverage.overall).toBeGreaterThan(0);
  });

  it("recency: an older observation weighs less (spec 37), but is never zero", () => {
    const makeObs = (id: string, year: string, value: "ochre" | "cream"): VisualObservation => ({
      sampleId: id,
      facadeColor: { value, confidence: 0.8 },
      quality: 0.9,
      provenance: { provider: "test-imagery", sourceId: id, capturedAt: `${year}-06-01T00:00:00Z`, retrievedAt: RETRIEVED },
    });
    const profile = aggregateEvidence(
      input({
        observations: [makeObs("r-1", "2026", "cream"), makeObs("o-1", "2015", "ochre")],
        samples: [sample("r-1", 60, 60), sample("o-1", -60, -60)],
      }),
    );
    expect(profile.facadeColors.dominant).toBe("cream"); // 2026 beats 2015
    expect(profile.facadeColors.scores.cream!).toBeGreaterThan(profile.facadeColors.scores.ochre!);
  });

  it("spatial cluster damping: many observations at one spot weigh less than spread ones (spec 38)", () => {
    const obsAt = (id: string, latM: number, lonM: number, value: "ochre" | "cream" = "ochre"): VisualObservation => ({
      sampleId: id,
      facadeColor: { value, confidence: 0.8 },
      quality: 0.9,
      provenance: { provider: "test-imagery", sourceId: id, retrievedAt: RETRIEVED },
    });
    const clustered = aggregateEvidence(
      input({
        observations: Array.from({ length: 8 }, (_, i) => obsAt(`c-${i}`, 10, 10)),
        samples: Array.from({ length: 8 }, (_, i) => sample(`c-${i}`, 10, 10)),
      }),
    );
    // 8:1 count at one spot vs one far competitor: without damping the cluster
    // would be 8/9 = 0.89 of the score; with 1/sqrt(8) damping the far
    // observation must stay clearly competitive
    const withCompetitor = aggregateEvidence(
      input({
        observations: [
          ...Array.from({ length: 8 }, (_, i) => obsAt(`c-${i}`, 10, 10)),
          obsAt("far", 400, 400, "cream"),
        ],
        samples: [...Array.from({ length: 8 }, (_, i) => sample(`c-${i}`, 10, 10)), sample("far", 400, 400)],
      }),
    );
    expect(withCompetitor.facadeColors.scores.cream!).toBeGreaterThan(0.2);
    expect(withCompetitor.facadeColors.dominant).toBe("ochre");
    expect(clustered.facadeColors.scores.ochre!).toBeCloseTo(1, 5);
    // the same 8 observations, spread over the cell, keep the full weight
    const spread = aggregateEvidence(
      input({
        observations: Array.from({ length: 8 }, (_, i) => obsAt(`s-${i}`, (i % 4) * 80 - 120, Math.floor(i / 4) * 80 - 120)),
        samples: Array.from({ length: 8 }, (_, i) => sample(`s-${i}`, (i % 4) * 80 - 120, Math.floor(i / 4) * 80 - 120)),
      }),
    );
    expect(spread.facadeColors.dominant).toBe("ochre");
  });

  it("source trust is per-axis (spec 130): low OSM trust flips a conflicting axis", () => {
    const osm: VisualEvidenceProfile = {
      schemaVersion: 1,
      cell: CELL,
      evidenceRevision: "osm:v1:trust123",
      facadeColors: { scores: { ochre: 1 }, dominant: "ochre", confidence: 0.9 },
      facadeMaterials: { scores: {}, confidence: 0 },
      roofTypes: { scores: {}, confidence: 0 },
      sidewalkTypes: { scores: {}, confidence: 0 },
      roadSurfaces: { scores: {}, confidence: 0 },
      vegetation: { scores: {}, confidence: 0 },
      urbanCharacter: { scores: {}, confidence: 0 },
      streetFurniture: { scores: {}, confidence: 0 },
      observedDensities: { tree: 0, streetLight: 0, bench: 0, bollard: 0, parkedVehicle: 0 },
      coverage: { requestedSamples: 0, usableSamples: 0, spatialCoverage: 0, directionalCoverage: 0, imageryConfidence: 0, osmConfidence: 0.9, overall: 0.45 },
      provenanceSummary: { providers: ["osm"], sampleCount: 0, retrievedAt: RETRIEVED },
    };
    const vision: VisualObservation[] = [
      { sampleId: "t-1", facadeColor: { value: "cream", confidence: 0.85 }, quality: 0.9, provenance: sample("t-1").provenance },
      { sampleId: "t-2", facadeColor: { value: "cream", confidence: 0.8 }, quality: 0.9, provenance: sample("t-2").provenance },
    ];
    const options: AggregatorOptions = {
      trust: { ...defaultTrust(), facadeColors: { osm: 0.1, vision: 1.0 } as AxisSourceTrust },
    };
    const profile = createEvidenceAggregator(options).aggregate(input({ osmEvidence: osm, observations: vision, samples: [sample("t-1", 50, 50), sample("t-2", -50, -50)] }));
    expect(profile.facadeColors.dominant).toBe("cream");
    // default trust keeps OSM winning the same conflict
    const profileDefault = aggregateEvidence(input({ osmEvidence: osm, observations: vision, samples: [sample("t-1", 50, 50), sample("t-2", -50, -50)] }));
    expect(profileDefault.facadeColors.dominant).toBe("ochre");
  });

  it("detections feed densities with saturation, union-combined with OSM (spec 92-93)", () => {
    const osm: VisualEvidenceProfile = {
      schemaVersion: 1,
      cell: CELL,
      evidenceRevision: "osm:v1:den00000",
      facadeColors: { scores: {}, confidence: 0 },
      facadeMaterials: { scores: {}, confidence: 0 },
      roofTypes: { scores: {}, confidence: 0 },
      sidewalkTypes: { scores: {}, confidence: 0 },
      roadSurfaces: { scores: {}, confidence: 0 },
      vegetation: { scores: {}, confidence: 0 },
      urbanCharacter: { scores: {}, confidence: 0 },
      streetFurniture: { scores: {}, confidence: 0 },
      observedDensities: { tree: 0.35, streetLight: 0.6, bench: 0.2, bollard: 0.15, parkedVehicle: 0.4 },
      coverage: { requestedSamples: 0, usableSamples: 0, spatialCoverage: 0, directionalCoverage: 0, imageryConfidence: 0, osmConfidence: 0, overall: 0 },
      provenanceSummary: { providers: ["osm"], sampleCount: 0, retrievedAt: RETRIEVED },
    };
    const profile = aggregateEvidence(
      input({
        osmEvidence: osm,
        observations: [],
        samples: [sample("d-1", 40, 40, undefined, ["tree", "tree", "tree"])],
      }),
    );
    const imgTree = 1 - Math.exp(-3 / 10);
    expect(profile.observedDensities.tree).toBeCloseTo(1 - (1 - 0.35) * (1 - imgTree), 4);
    expect(profile.observedDensities.streetLight).toBeCloseTo(0.6, 5);
    expect(profile.observedDensities.parkedVehicle).toBeCloseTo(0.4, 5); // unchanged
  });

  it("vehicle detections do not count as parked vehicles (documented decision)", () => {
    const profile = aggregateEvidence(
      input({ observations: [], samples: [sample("d-1", 40, 40, undefined, ["vehicle", "vehicle", "vehicle", "vehicle"])] }),
    );
    expect(profile.observedDensities.parkedVehicle).toBe(0);
    expect(profile.observedDensities.tree).toBe(0);
  });

  it("coverage: directional spread over 4 quadrants, usable vs requested (spec 39)", () => {
    const obs = romeHistoricObservations;
    const full = aggregateEvidence(
      input({ observations: obs, samples: [sample("obs-rome-historic-1", 100, 100, 10), sample("obs-rome-historic-2", -100, -100, 190)] }),
    );
    expect(full.coverage.requestedSamples).toBe(12);
    expect(full.coverage.usableSamples).toBe(2);
    expect(full.coverage.directionalCoverage).toBeCloseTo(0.5, 5); // NE + SW quadrants
    const sameQuadrant = aggregateEvidence(
      input({ observations: obs, samples: [sample("obs-rome-historic-1", 100, 100, 10), sample("obs-rome-historic-2", 140, 120, 40)] }),
    );
    expect(sameQuadrant.coverage.directionalCoverage).toBeCloseTo(0.25, 5);
  });

  it("zero-quality (fallback) observations contribute nothing", () => {
    const fallback: VisualObservation = { sampleId: "obs-rome-historic-3", quality: 0, provenance: sample("obs-rome-historic-3").provenance };
    const withFallback = aggregateEvidence(input({ observations: [...romeHistoricObservations, fallback] }));
    const baseline = aggregateEvidence(input({}));
    expect(withFallback.facadeColors).toEqual(baseline.facadeColors);
    expect(withFallback.coverage.usableSamples).toBe(2);
  });

  it("evidenceRevision is deterministic, versioned and input-sensitive (spec 57, 116)", () => {
    const a = aggregateEvidence(input());
    const b = aggregateEvidence(input());
    expect(a.evidenceRevision).toBe(b.evidenceRevision);
    expect(a.evidenceRevision).toMatch(new RegExp(`^agg:v1:a${AGGREGATOR_REVISION}:[0-9a-f]{8}$`));
    const shifted = aggregateEvidence(
      input({
        observations: romeHistoricObservations.map((o) => ({ ...o, facadeColor: { value: "cream", confidence: 0.9 } as const })),
      }),
    );
    expect(shifted.evidenceRevision).not.toBe(a.evidenceRevision);
  });

  it("provenance summary merges providers, counts usable samples, keeps the captured range", () => {
    const profile = aggregateEvidence(input({}));
    expect(profile.provenanceSummary.providers).toEqual(["test-imagery"]);
    expect(profile.provenanceSummary.sampleCount).toBe(2);
    expect(profile.provenanceSummary.retrievedAt).toBe(RETRIEVED);
    expect(profile.provenanceSummary.earliestCapturedAt).toBe("2026-01-15T09:00:00Z");
    expect(profile.provenanceSummary.latestCapturedAt).toBe("2026-01-15T09:00:00Z");
  });

  it("is order-independent: shuffled observations/samples give the same profile", () => {
    const base = aggregateEvidence(input());
    const shuffled = aggregateEvidence(
      input({ observations: [...romeHistoricObservations].reverse(), samples: [sample("obs-rome-historic-2", -120, -100), sample("obs-rome-historic-1", 100, 100)] }),
    );
    expect(shuffled).toEqual(base);
  });

  it("empty input yields a well-formed empty profile (never throws, never invents)", () => {
    const profile = aggregateEvidence({ cell: CELL, observations: [], requestedSamples: 0, retrievedAt: RETRIEVED });
    for (const axis of ["facadeColors", "facadeMaterials", "roofTypes", "sidewalkTypes", "roadSurfaces", "vegetation", "urbanCharacter", "streetFurniture"] as const) {
      expect(profile[axis].confidence).toBe(0);
      expect(profile[axis].scores).toEqual({});
    }
    expect(profile.coverage.overall).toBe(0);
    expect(profile.schemaVersion).toBe(1);
    expect(profile.cell).toEqual(CELL);
  });

  it("scores sum to ~1 whenever a distribution is non-empty", () => {
    const cases: Array<[string, readonly VisualObservation[]]> = [
      ["rome", romeHistoricObservations],
      ["paris", parisCentralObservations],
      ["tokyo", tokyoDenseObservations],
    ];
    for (const [name, obs] of cases) {
      const profile = aggregateEvidence(input({ observations: obs, samples: obs.map((o) => sample(o.sampleId, 100, 100)) }));
      for (const axis of ["facadeColors", "facadeMaterials", "roofTypes", "sidewalkTypes", "roadSurfaces", "vegetation", "urbanCharacter"] as const) {
        const sum = (Object.values(profile[axis].scores) as Array<number | undefined>).reduce<number>((acc, v) => acc + (v ?? 0), 0);
        if (Object.keys(profile[axis].scores).length > 0) {
          expect(sum, `${name}/${axis}`).toBeCloseTo(1, 2);
        }
      }
    }
  });
});

// local copy for the custom-trust test (keeps the default table untouched)
function defaultTrust() {
  return {
    facadeColors: { osm: 1.0, vision: 0.9 },
    facadeMaterials: { osm: 1.0, vision: 0.8 },
    roofTypes: { osm: 1.0, vision: 0.8 },
    sidewalkTypes: { osm: 0.8, vision: 0.9 },
    roadSurfaces: { osm: 0.9, vision: 0.8 },
    vegetation: { osm: 0.6, vision: 0.8 },
    urbanCharacter: { osm: 0.5, vision: 0.8 },
    streetFurniture: { osm: 0.6, vision: 0.8 },
  };
}
