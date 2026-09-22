import type { VisualObservation } from "../types.ts";

/**
 * Regression fixtures: provider-independent VisualObservation[] (spec 115).
 * No images are stored (licensing), only structured observations, so the
 * aggregator and compiler stay testable offline. Values are coherent with
 * the VPS-01 evidence fixtures (same dominant classes per city family).
 *
 * sampleIds are stable contract values: the VPS-08 aggregator fixtures and
 * the VPS-09 end-to-end tests reference them.
 */

const RETRIEVED = "2026-09-21T00:00:00Z";

function provenance(sourceId: string) {
  return {
    provider: "test-imagery",
    sourceId,
    retrievedAt: RETRIEVED,
  } as const;
}

export const romeHistoricObservations: readonly VisualObservation[] = [
  {
    sampleId: "obs-rome-historic-1",
    facadeColor: { value: "ochre", confidence: 0.85 },
    facadeMaterial: { value: "plaster", confidence: 0.7 },
    roofType: { value: "terracotta-tile", confidence: 0.8 },
    sidewalkType: { value: "warm-stone", confidence: 0.75 },
    roadSurface: { value: "asphalt", confidence: 0.6 },
    vegetationCharacter: { value: "mediterranean-urban", confidence: 0.72 },
    urbanCharacter: { value: "historic-dense", confidence: 0.8 },
    quality: 0.9,
    provenance: provenance("obs-rome-historic-1"),
  },
  {
    sampleId: "obs-rome-historic-2",
    facadeColor: { value: "cream", confidence: 0.7 },
    facadeMaterial: { value: "stone", confidence: 0.65 },
    roofType: { value: "terracotta-tile", confidence: 0.75 },
    sidewalkType: { value: "warm-stone", confidence: 0.6 },
    roadSurface: { value: "cobblestone", confidence: 0.55 },
    vegetationCharacter: { value: "mediterranean-urban", confidence: 0.6 },
    urbanCharacter: { value: "historic-dense", confidence: 0.7 },
    quality: 0.8,
    provenance: provenance("obs-rome-historic-2"),
  },
];

export const parisCentralObservations: readonly VisualObservation[] = [
  {
    sampleId: "obs-paris-central-1",
    facadeColor: { value: "cream", confidence: 0.8 },
    facadeMaterial: { value: "plaster", confidence: 0.75 },
    roofType: { value: "zinc", confidence: 0.8 },
    sidewalkType: { value: "light-stone", confidence: 0.7 },
    roadSurface: { value: "asphalt", confidence: 0.7 },
    vegetationCharacter: { value: "temperate-urban", confidence: 0.7 },
    urbanCharacter: { value: "historic-medium", confidence: 0.75 },
    quality: 0.85,
    provenance: provenance("obs-paris-central-1"),
  },
  {
    sampleId: "obs-paris-central-2",
    facadeColor: { value: "sand", confidence: 0.65 },
    facadeMaterial: { value: "stone", confidence: 0.6 },
    roofType: { value: "zinc", confidence: 0.7 },
    sidewalkType: { value: "light-stone", confidence: 0.65 },
    roadSurface: { value: "asphalt", confidence: 0.6 },
    vegetationCharacter: { value: "temperate-urban", confidence: 0.55 },
    urbanCharacter: { value: "historic-medium", confidence: 0.65 },
    quality: 0.75,
    provenance: provenance("obs-paris-central-2"),
  },
];

export const tokyoDenseObservations: readonly VisualObservation[] = [
  {
    sampleId: "obs-tokyo-dense-1",
    facadeColor: { value: "dark", confidence: 0.7 },
    facadeMaterial: { value: "concrete", confidence: 0.75 },
    roofType: { value: "metal", confidence: 0.7 },
    sidewalkType: { value: "concrete", confidence: 0.7 },
    roadSurface: { value: "asphalt", confidence: 0.8 },
    vegetationCharacter: { value: "temperate-urban", confidence: 0.5 },
    urbanCharacter: { value: "modern-dense", confidence: 0.85 },
    quality: 0.8,
    provenance: provenance("obs-tokyo-dense-1"),
  },
  {
    sampleId: "obs-tokyo-dense-2",
    facadeColor: { value: "cool-grey", confidence: 0.65 },
    facadeMaterial: { value: "glass", confidence: 0.6 },
    roofType: { value: "flat-concrete", confidence: 0.65 },
    sidewalkType: { value: "concrete", confidence: 0.6 },
    roadSurface: { value: "asphalt", confidence: 0.75 },
    vegetationCharacter: { value: "sparse", confidence: 0.55 },
    urbanCharacter: { value: "modern-dense", confidence: 0.8 },
    quality: 0.75,
    provenance: provenance("obs-tokyo-dense-2"),
  },
];

export const OBSERVATION_FIXTURES: Readonly<Record<string, readonly VisualObservation[]>> = {
  "vps-fixture-rome-historic": romeHistoricObservations,
  "vps-fixture-paris-central": parisCentralObservations,
  "vps-fixture-tokyo-dense": tokyoDenseObservations,
};
