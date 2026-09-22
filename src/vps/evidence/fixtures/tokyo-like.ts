import type { VisualEvidenceProfile } from "../types.ts";

/**
 * Offline Tokyo-like evidence (VPS-01, spec 97/140): hand-authored,
 * provider-independent observations of a dense East-Asian core — concrete
 * and glass facades, flat/metal roofs, concrete sidewalks, sparse
 * temperate-green streets.
 */
export const tokyoLikeEvidence: VisualEvidenceProfile = {
  schemaVersion: 1,
  cell: {
    id: "vps-fixture-tokyo-dense",
    center: { latitude: 35.6762, longitude: 139.6503 },
    bounds: { south: 35.6715, west: 139.642, north: 35.681, east: 139.6585 },
    resolution: 8,
  },
  evidenceRevision: "fixture-v1",
  facadeColors: {
    scores: { "cool-grey": 0.4, dark: 0.25, white: 0.2, mixed: 0.15 },
    dominant: "cool-grey",
    confidence: 0.79,
  },
  facadeMaterials: {
    scores: { concrete: 0.5, glass: 0.25, metal: 0.15, plaster: 0.1 },
    dominant: "concrete",
    confidence: 0.8,
  },
  roofTypes: {
    scores: { "flat-concrete": 0.6, metal: 0.2, "dark-tile": 0.15, mixed: 0.05 },
    dominant: "flat-concrete",
    confidence: 0.77,
  },
  sidewalkTypes: {
    scores: { concrete: 0.6, asphalt: 0.2, pavers: 0.15, mixed: 0.05 },
    dominant: "concrete",
    confidence: 0.75,
  },
  roadSurfaces: {
    scores: { asphalt: 0.85, concrete: 0.15 },
    dominant: "asphalt",
    confidence: 0.8,
  },
  vegetation: {
    scores: { "temperate-urban": 0.5, sparse: 0.3, "continental-urban": 0.2 },
    dominant: "temperate-urban",
    confidence: 0.62,
  },
  urbanCharacter: {
    scores: { "modern-dense": 0.6, "modern-medium": 0.3, commercial: 0.1 },
    dominant: "modern-dense",
    confidence: 0.81,
  },
  streetFurniture: {
    scores: { "east-asian": 0.6, minimal: 0.25, "modern-europe": 0.15 },
    dominant: "east-asian",
    confidence: 0.68,
  },
  observedDensities: {
    tree: 0.2,
    streetLight: 0.8,
    bench: 0.08,
    bollard: 0.25,
    parkedVehicle: 0.3,
  },
  coverage: {
    requestedSamples: 24,
    usableSamples: 21,
    spatialCoverage: 0.83,
    directionalCoverage: 0.78,
    imageryConfidence: 0.82,
    osmConfidence: 0.72,
    overall: 0.82,
  },
  provenanceSummary: {
    providers: ["osm", "street-imagery"],
    sampleCount: 21,
    earliestCapturedAt: "2020-03-08T09:31:00Z",
    latestCapturedAt: "2025-08-19T13:57:00Z",
    retrievedAt: "2026-09-21T00:00:00Z",
  },
};
