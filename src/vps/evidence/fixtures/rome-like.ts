import type { VisualEvidenceProfile } from "../types.ts";

/**
 * Offline Rome-like evidence (VPS-01, spec 97/140): hand-authored,
 * provider-independent observations of a Mediterranean historic center.
 * Distribution shapes follow the spec example (section 85).
 */
export const romeLikeEvidence: VisualEvidenceProfile = {
  schemaVersion: 1,
  cell: {
    id: "vps-fixture-rome-historic",
    center: { latitude: 41.8992, longitude: 12.4769 },
    bounds: { south: 41.895, west: 12.47, north: 41.9035, east: 12.484 },
    resolution: 8,
  },
  evidenceRevision: "fixture-v1",
  facadeColors: {
    scores: { cream: 0.18, sand: 0.31, ochre: 0.34, "warm-grey": 0.17 },
    dominant: "ochre",
    confidence: 0.84,
  },
  facadeMaterials: {
    scores: { plaster: 0.5, stone: 0.3, brick: 0.2 },
    dominant: "plaster",
    confidence: 0.72,
  },
  roofTypes: {
    scores: { "terracotta-tile": 0.63, "flat-concrete": 0.24, "dark-tile": 0.09, unknown: 0.04 },
    dominant: "terracotta-tile",
    confidence: 0.81,
  },
  sidewalkTypes: {
    scores: { "warm-stone": 0.58, pavers: 0.21, concrete: 0.14, unknown: 0.07 },
    dominant: "warm-stone",
    confidence: 0.76,
  },
  roadSurfaces: {
    scores: { asphalt: 0.7, cobblestone: 0.25, mixed: 0.05 },
    dominant: "asphalt",
    confidence: 0.68,
  },
  vegetation: {
    scores: { "mediterranean-urban": 0.72, "temperate-urban": 0.2, unknown: 0.08 },
    dominant: "mediterranean-urban",
    confidence: 0.73,
  },
  urbanCharacter: {
    scores: { "historic-dense": 0.7, "historic-medium": 0.25, mixed: 0.05 },
    dominant: "historic-dense",
    confidence: 0.8,
  },
  streetFurniture: {
    scores: { "classic-europe": 0.75, mixed: 0.25 },
    dominant: "classic-europe",
    confidence: 0.7,
  },
  observedDensities: {
    tree: 0.35,
    streetLight: 0.6,
    bench: 0.2,
    bollard: 0.15,
    parkedVehicle: 0.4,
  },
  coverage: {
    requestedSamples: 24,
    usableSamples: 18,
    spatialCoverage: 0.82,
    directionalCoverage: 0.75,
    imageryConfidence: 0.81,
    osmConfidence: 0.74,
    overall: 0.81,
  },
  provenanceSummary: {
    providers: ["osm", "street-imagery"],
    sampleCount: 18,
    earliestCapturedAt: "2021-05-14T08:12:00Z",
    latestCapturedAt: "2025-06-02T17:40:00Z",
    retrievedAt: "2026-09-21T00:00:00Z",
  },
};
