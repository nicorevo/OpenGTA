import type { VisualEvidenceProfile } from "../types.ts";

/**
 * Offline Paris-like evidence (VPS-01, spec 97/140): hand-authored,
 * provider-independent observations of a Haussmannian center — zinc roofs,
 * limestone/cream facades, light stone sidewalks, temperate streets.
 */
export const parisLikeEvidence: VisualEvidenceProfile = {
  schemaVersion: 1,
  cell: {
    id: "vps-fixture-paris-central",
    center: { latitude: 48.8566, longitude: 2.3522 },
    bounds: { south: 48.8525, west: 2.3445, north: 48.8607, east: 2.36 },
    resolution: 8,
  },
  evidenceRevision: "fixture-v1",
  facadeColors: {
    scores: { cream: 0.38, white: 0.3, "cool-grey": 0.2, "warm-grey": 0.12 },
    dominant: "cream",
    confidence: 0.82,
  },
  facadeMaterials: {
    scores: { stone: 0.55, plaster: 0.35, mixed: 0.1 },
    dominant: "stone",
    confidence: 0.78,
  },
  roofTypes: {
    scores: { zinc: 0.62, slate: 0.25, metal: 0.08, mixed: 0.05 },
    dominant: "zinc",
    confidence: 0.83,
  },
  sidewalkTypes: {
    scores: { "light-stone": 0.62, concrete: 0.2, pavers: 0.12, unknown: 0.06 },
    dominant: "light-stone",
    confidence: 0.77,
  },
  roadSurfaces: {
    scores: { asphalt: 0.8, mixed: 0.2 },
    dominant: "asphalt",
    confidence: 0.71,
  },
  vegetation: {
    scores: { "temperate-urban": 0.75, "mediterranean-urban": 0.15, sparse: 0.1 },
    dominant: "temperate-urban",
    confidence: 0.74,
  },
  urbanCharacter: {
    scores: { "historic-medium": 0.5, "modern-medium": 0.35, mixed: 0.15 },
    dominant: "historic-medium",
    confidence: 0.66,
  },
  streetFurniture: {
    scores: { "classic-europe": 0.8, "modern-europe": 0.2 },
    dominant: "classic-europe",
    confidence: 0.72,
  },
  observedDensities: {
    tree: 0.45,
    streetLight: 0.7,
    bench: 0.3,
    bollard: 0.1,
    parkedVehicle: 0.35,
  },
  coverage: {
    requestedSamples: 24,
    usableSamples: 20,
    spatialCoverage: 0.85,
    directionalCoverage: 0.8,
    imageryConfidence: 0.84,
    osmConfidence: 0.7,
    overall: 0.83,
  },
  provenanceSummary: {
    providers: ["osm", "street-imagery"],
    sampleCount: 20,
    earliestCapturedAt: "2019-04-22T10:05:00Z",
    latestCapturedAt: "2025-07-11T15:22:00Z",
    retrievedAt: "2026-09-21T00:00:00Z",
  },
};
