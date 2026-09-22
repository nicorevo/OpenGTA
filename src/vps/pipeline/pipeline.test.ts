import { describe, it, expect } from "vitest";
import { createVisualPipeline, type PipelineResult } from "./pipeline.ts";
import { cellForCoordinates } from "../cell/cell.ts";
import { OSM_CITY_FEATURES } from "../osm/city-fixtures.ts";
import type { OsmCellFeatures } from "../osm/types.ts";
import { createTestImageryProvider } from "../providers/street-imagery/test-provider.ts";
import type { ProviderDetection, StreetSample } from "../providers/street-imagery/types.ts";
import { createTestVisualAnalyzer } from "../analysis/test-analyzer.ts";
import {
  OBSERVATION_FIXTURES,
  romeHistoricObservations,
  parisCentralObservations,
  tokyoDenseObservations,
} from "../analysis/fixtures/observations.ts";
import { createProfileCompiler, COMPILER_REVISION } from "../compiler/compiler.ts";
import { defaultCatalog } from "../catalog/catalog.ts";
import { createEvidenceCache, type EvidenceCache } from "../cache/evidence-cache.ts";
import { createProfileCache, type ProfileCache } from "../cache/profile-cache.ts";
import { romeProfile } from "../../render/theme/profiles/rome.ts";
import { parisProfile } from "../../render/theme/profiles/paris.ts";
import { tokyoProfile } from "../../render/theme/profiles/tokyo.ts";
import type { VisualProfile } from "../../render/theme/types.ts";
import type { SpatialCell } from "../evidence/types.ts";

const RETRIEVED_AT = "2026-09-21T00:00:00Z";
const CAPTURED_AT = "2026-01-15T09:00:00Z";

interface CitySetup {
  readonly key: "rome" | "paris" | "tokyo";
  readonly lat: number;
  readonly lon: number;
  readonly parent: VisualProfile;
  readonly observations: readonly import("../analysis/types.ts").VisualObservation[];
  readonly samplePrefix: string;
}

const CITIES: readonly CitySetup[] = [
  { key: "rome", lat: 41.8992, lon: 12.4769, parent: romeProfile, observations: romeHistoricObservations, samplePrefix: "obs-rome-historic" },
  { key: "paris", lat: 48.8566, lon: 2.3522, parent: parisProfile, observations: parisCentralObservations, samplePrefix: "obs-paris-central" },
  { key: "tokyo", lat: 35.6762, lon: 139.6503, parent: tokyoProfile, observations: tokyoDenseObservations, samplePrefix: "obs-tokyo-dense" },
];

function detection(canonicalClass: string): ProviderDetection {
  return {
    canonicalClass,
    providerClass: canonicalClass,
    provenance: { provider: "test-imagery", capturedAt: CAPTURED_AT, retrievedAt: RETRIEVED_AT },
  };
}

/** Two matched samples (observations exist) + two unmatched (fallback path). */
function samplePool(city: CitySetup, cell: SpatialCell): StreetSample[] {
  const d = 0.0015; // ~160 m
  const mk = (sourceId: string, dLat: number, dLon: number, heading: number, detections?: readonly ProviderDetection[]): StreetSample => ({
    provider: "test-imagery",
    sourceId,
    latitude: cell.center.latitude + dLat,
    longitude: cell.center.longitude + dLon,
    capturedAt: CAPTURED_AT,
    heading,
    ...(detections !== undefined ? { detections } : {}),
    provenance: { provider: "test-imagery", sourceId, capturedAt: CAPTURED_AT, retrievedAt: RETRIEVED_AT },
  });
  return [
    mk(`${city.samplePrefix}-1`, d, d, 45, [detection("tree"), detection("bench")]),
    mk(`${city.samplePrefix}-2`, -d, -d, 225),
    mk(`${city.samplePrefix}-extra-1`, 0, d, 90),
    mk(`${city.samplePrefix}-extra-2`, -d, 0, 270),
  ];
}

interface PipelineHarness {
  readonly cell: SpatialCell;
  readonly pipeline: ReturnType<typeof createVisualPipeline>;
  readonly evidenceCache: EvidenceCache;
  readonly profileCache: ProfileCache;
}

/**
 * A validated VisualObservation carries the sample provenance; the RAW model
 * output (what the analyzer map stores on purpose) never does, so strip it
 * before feeding the same strict validator a live model would hit (spec 30).
 */
function toRaw(obs: import("../analysis/types.ts").VisualObservation): unknown {
  const { provenance: _provenance, ...rest } = obs;
  return rest;
}

function buildPipeline(
  city: CitySetup,
  overrides: {
    osmSource?: (cell: SpatialCell) => Promise<OsmCellFeatures> | OsmCellFeatures;
    imagery?: ReturnType<typeof createTestImageryProvider>;
    observations?: readonly import("../analysis/types.ts").VisualObservation[];
  } = {},
): PipelineHarness {
  const cell = cellForCoordinates(city.lat, city.lon);
  const pool = samplePool(city, cell);
  const observations = overrides.observations ?? city.observations;
  const rawBySampleId = new Map(observations.map((o) => [o.sampleId, toRaw(o)]));
  const evidenceCache = createEvidenceCache();
  const profileCache = createProfileCache();
  const pipeline = createVisualPipeline({
    osmSource: overrides.osmSource ?? (async () => OSM_CITY_FEATURES[city.key]),
    imagery: overrides.imagery ?? createTestImageryProvider(pool),
    analyzer: createTestVisualAnalyzer(rawBySampleId),
    compiler: createProfileCompiler(),
    catalog: defaultCatalog,
    resolveParent: () => city.parent,
    evidenceCache,
    profileCache,
  });
  return { cell, pipeline, evidenceCache, profileCache };
}

function assertCompleteProfile(profile: PipelineResult["profile"], parent: VisualProfile): void {
  expect(profile.schemaVersion).toBe(1);
  expect(profile.id).toMatch(/^vps:v1:h3:[0-9a-f]+:c1$/);
  expect(profile.buildings.facadePalette.length).toBeGreaterThan(0);
  expect(profile.buildings.roofPalette.length).toBeGreaterThan(0);
  expect(profile.buildings.facadePalette[0]).not.toBeUndefined();
  expect(profile.ground.base).not.toBeUndefined();
  expect(profile.roads.base.fill).not.toBeUndefined();
  expect(profile.generation.source).toBe("generated");
  expect(profile.generation.compilerRevision).toBe(COMPILER_REVISION);
  expect(profile.generation.catalogRevision).toBe(defaultCatalog.catalogRevision);
  expect(profile.generation.confidence).toBeGreaterThanOrEqual(0);
  expect(profile.generation.confidence).toBeLessThanOrEqual(1);
  expect(profile.generation.generatedAt).toBe(RETRIEVED_AT);
  // nothing generated below the parent level may be undefined
  expect(parent.schemaVersion).toBe(1);
}

describe("VPS-09 end-to-end: collect -> analyze -> aggregate -> compile -> cache -> serve (spec 105)", () => {
  it("rome: the full chain produces a generated profile from OSM + vision + detections", async () => {
    const city = CITIES[0];
    const { cell, pipeline, evidenceCache, profileCache } = buildPipeline(city);
    const result = await pipeline.run(cell, RETRIEVED_AT);

    // collect + aggregate
    expect(result.diagnostics.osm).toBe("ok");
    expect(result.diagnostics.imagery).toBe("ok");
    expect(result.diagnostics.analyzedSamples).toBe(4);
    expect(result.diagnostics.requestedSamples).toBeGreaterThan(0);
    expect(result.evidence.roofTypes.dominant).toBe("terracotta-tile");
    expect(result.evidence.facadeColors.dominant).toBe("ochre");
    expect(result.evidence.urbanCharacter.dominant).toBe("historic-dense");
    expect(result.evidence.coverage.usableSamples).toBe(2); // only the two matched samples classify
    expect(result.evidence.provenanceSummary.providers).toEqual(["osm", "test-imagery"]);
    expect(result.evidence.provenanceSummary.sampleCount).toBe(2);
    expect(result.evidence.provenanceSummary.earliestCapturedAt).toBe(CAPTURED_AT);
    expect(result.evidence.provenanceSummary.latestCapturedAt).toBe(CAPTURED_AT);
    // detections unioned into densities (OSM already had trees: still higher than 0)
    expect(result.evidence.observedDensities.tree).toBeGreaterThan(0);
    expect(result.evidence.observedDensities.bench).toBeGreaterThan(0);

    // compile + serve
    const { profile } = result;
    assertCompleteProfile(profile, city.parent);
    expect(profile.generation.cellId).toBe(cell.id);
    expect(profile.generation.evidenceRevision).toBe(result.evidence.evidenceRevision);
    expect(result.evidence.evidenceRevision).toMatch(/^agg:v1:a1:[0-9a-f]{8}$/);

    // cache: both layers populated
    expect(evidenceCache.has(cell.id, 1, result.evidence.evidenceRevision)).toBe(true);
    expect(profileCache.has(cell.id, 1, COMPILER_REVISION, defaultCatalog.catalogRevision)).toBe(true);
  });

  it("paris: OSM tags blend with vision (cream facades, metal roofs, historic-medium)", async () => {
    const city = CITIES[1];
    const { cell, pipeline } = buildPipeline(city);
    const result = await pipeline.run(cell, RETRIEVED_AT);

    expect(result.evidence.facadeColors.dominant).toBe("cream");
    expect(result.evidence.roofTypes.dominant).toBe("metal");
    expect(result.evidence.urbanCharacter.dominant).toBe("historic-medium");
    expect(result.evidence.vegetation.dominant).toBe("temperate-urban");
    assertCompleteProfile(result.profile, city.parent);
  });

  it("tokyo: flat concrete roofs, cool-grey facades, modern-dense character", async () => {
    const city = CITIES[2];
    const { cell, pipeline } = buildPipeline(city);
    const result = await pipeline.run(cell, RETRIEVED_AT);

    expect(result.evidence.roofTypes.dominant).toBe("flat-concrete");
    expect(result.evidence.facadeColors.dominant).toBe("cool-grey");
    expect(result.evidence.urbanCharacter.dominant).toBe("modern-dense");
    expect(result.evidence.vegetation.dominant).toBe("sparse");
    assertCompleteProfile(result.profile, city.parent);
  });

  it("the three cities produce pairwise distinct generated profiles (spec 109.1)", async () => {
    const results = await Promise.all(
      CITIES.map(async (city) => {
        const { cell, pipeline } = buildPipeline(city);
        return { city, result: await pipeline.run(cell, RETRIEVED_AT) };
      }),
    );
    for (let i = 0; i < results.length; i += 1) {
      for (let j = i + 1; j < results.length; j += 1) {
        const a = results[i].result.profile;
        const b = results[j].result.profile;
        expect(a, `${results[i].city.key} vs ${results[j].city.key}`).not.toEqual(b);
        const distinctPalette =
          a.buildings.roofPalette[0] !== b.buildings.roofPalette[0] || a.buildings.facadePalette[0] !== b.buildings.facadePalette[0];
        expect(distinctPalette, `${results[i].city.key} vs ${results[j].city.key} must look different`).toBe(true);
      }
    }
  });

  it("is deterministic: two fresh runs give identical evidence and profiles", async () => {
    const city = CITIES[0];
    const a = buildPipeline(city);
    const b = buildPipeline(city);
    const ra = await a.pipeline.run(a.cell, RETRIEVED_AT);
    const rb = await b.pipeline.run(b.cell, RETRIEVED_AT);
    expect(ra.evidence).toEqual(rb.evidence);
    expect(ra.profile).toEqual(rb.profile);
    expect(ra.evidence.evidenceRevision).toBe(rb.evidence.evidenceRevision);
    expect(ra.profile.id).toBe(rb.profile.id);
  });

  it("serves the second run from the caches (spec 55-57: stable objects, no recompile)", async () => {
    const city = CITIES[1];
    const { cell, pipeline } = buildPipeline(city);
    const first = await pipeline.run(cell, RETRIEVED_AT);
    expect(first.diagnostics.evidenceCacheHit).toBe(false);
    expect(first.diagnostics.profileCacheHit).toBe(false);

    const second = await pipeline.run(cell, RETRIEVED_AT);
    expect(second.diagnostics.evidenceCacheHit).toBe(true);
    expect(second.diagnostics.profileCacheHit).toBe(true);
    expect(second.profile).toBe(first.profile);
    expect(second.evidence).toBe(first.evidence);
  });

  it("a new evidence run never shadows the previous one (spec 57)", async () => {
    const city = CITIES[0];
    let features: OsmCellFeatures = OSM_CITY_FEATURES.rome;
    const { cell, pipeline, evidenceCache } = buildPipeline(city, { osmSource: async () => features });
    const first = await pipeline.run(cell, RETRIEVED_AT);

    // a new evidence run: one building re-coloured
    features = {
      ...features,
      areas: features.areas.map((a, i) => (i === 0 ? { ...a, tags: { ...a.tags, "building:colour": "cream" } } : a)),
    };
    const second = await pipeline.run(cell, RETRIEVED_AT);

    expect(second.evidence.evidenceRevision).not.toBe(first.evidence.evidenceRevision);
    expect(second.diagnostics.evidenceCacheHit).toBe(false);
    // no recompile needed only when the evidence is the same; a new revision recompiles
    expect(second.diagnostics.profileCacheHit).toBe(false);
    // both revisions coexist in the evidence cache
    expect(evidenceCache.size).toBe(2);
    expect(evidenceCache.get(cell.id, 1, first.evidence.evidenceRevision)).toBe(first.evidence);
  });

  it("an OSM failure degrades to vision-only and never throws (spec 80)", async () => {
    const city = CITIES[0];
    const { cell, pipeline } = buildPipeline(city, {
      osmSource: async () => {
        throw new Error("osm endpoint down");
      },
    });
    const result = await pipeline.run(cell, RETRIEVED_AT);

    expect(result.diagnostics.osm).toBe("failed");
    expect(result.diagnostics.imagery).toBe("ok");
    expect(result.evidence.provenanceSummary.providers).toEqual(["test-imagery"]);
    expect(result.evidence.coverage.osmConfidence).toBe(0);
    // vision still drives the profile (two agreeing observations)
    expect(result.evidence.roofTypes.dominant).toBe("terracotta-tile");
    expect(result.profile.generation.confidence).toBeGreaterThan(0);
    assertCompleteProfile(result.profile, city.parent);
  });

  it("an imagery failure degrades to OSM-only and never throws (spec 80)", async () => {
    const city = CITIES[2];
    const failing = {
      async sample() {
        throw new Error("mapillary rate limited");
      },
    } as unknown as ReturnType<typeof createTestImageryProvider>;
    const { cell, pipeline } = buildPipeline(city, { imagery: failing });
    const result = await pipeline.run(cell, RETRIEVED_AT);

    expect(result.diagnostics.imagery).toBe("failed");
    expect(result.diagnostics.osm).toBe("ok");
    expect(result.diagnostics.analyzedSamples).toBe(0);
    expect(result.evidence.provenanceSummary.providers).toEqual(["osm"]);
    expect(result.evidence.coverage.imageryConfidence).toBe(0);
    expect(result.evidence.roofTypes.dominant).toBe("flat-concrete");
    assertCompleteProfile(result.profile, city.parent);
  });

  it("total source failure degrades to the parent LVP profile and never throws (spec 80, 110-111)", async () => {
    const city = CITIES[1];
    const failingImagery = {
      async sample() {
        throw new Error("no imagery at all");
      },
    } as unknown as ReturnType<typeof createTestImageryProvider>;
    const { cell, pipeline } = buildPipeline(city, {
      osmSource: async () => {
        throw new Error("osm down");
      },
      imagery: failingImagery,
    });
    const result = await pipeline.run(cell, RETRIEVED_AT);

    expect(result.diagnostics.osm).toBe("failed");
    expect(result.diagnostics.imagery).toBe("failed");
    expect(result.evidence.coverage.overall).toBe(0);
    expect(result.profile.generation.confidence).toBe(0);
    // every generated category falls back to the parent LVP values
    expect(result.profile.buildings.facadePalette).toEqual(city.parent.buildings.facadePalette);
    expect(result.profile.buildings.roofPalette).toEqual(city.parent.buildings.roofPalette);
    expect(result.profile.ground).toEqual(city.parent.ground);
    expect(result.profile.roads).toEqual(city.parent.roads);
  });

  it("fallback observations (no raw output) never pollute the aggregation (spec 78)", async () => {
    const city = CITIES[0];
    const { cell, pipeline } = buildPipeline(city);
    const result = await pipeline.run(cell, RETRIEVED_AT);
    // 4 samples analyzed, only 2 usable: the two unmatched samples fell back
    expect(result.diagnostics.analyzedSamples).toBe(4);
    expect(result.evidence.coverage.usableSamples).toBe(2);
    expect(result.evidence.coverage.imageryConfidence).toBeGreaterThan(0);
    // same generated profile as if the unmatched samples had never been
    // delivered (spec 78: fallbacks carry no evidence), only the run
    // identity differs — different samples mean a different evidence run (spec 57)
    const lean = buildPipeline(city, {
      imagery: createTestImageryProvider(samplePool(city, cell).slice(0, 2)),
    });
    const leanResult = await lean.pipeline.run(lean.cell, RETRIEVED_AT);
    const stripRevision = (p: PipelineResult["profile"]) => ({ ...p, generation: { ...p.generation, evidenceRevision: "" } });
    expect(stripRevision(result.profile)).toEqual(stripRevision(leanResult.profile));
    expect(result.evidence.evidenceRevision).not.toBe(leanResult.evidence.evidenceRevision);
  });

  it("observation fixtures stay provider-independent contract values (spec 115)", () => {
    for (const city of CITIES) {
      expect(OBSERVATION_FIXTURES[`vps-fixture-${city.key === "rome" ? "rome-historic" : city.key === "paris" ? "paris-central" : "tokyo-dense"}`]).toBe(
        city.observations,
      );
    }
  });
});
