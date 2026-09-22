import { stableStringHash } from "../../render/theme/hash.ts";
import type {
  Distribution,
  ObservedDensities,
  SpatialCell,
  VisualEvidenceProfile,
} from "../evidence/types.ts";
import type { StreetSample } from "../providers/street-imagery/types.ts";
import { ANALYZER_REVISION, type ClassificationResult, type VisualObservation } from "../analysis/types.ts";
export { AGGREGATOR_REVISION } from "./types.ts";
import {
  AGGREGATOR_REVISION,
  DEFAULT_RECENCY_BANDS,
  DEFAULT_SPATIAL_CLUSTER_METERS,
  DEFAULT_SOURCE_TRUST,
  VISION_CONFIDENCE_SAMPLE_CAP,
  type AggregationInput,
  type AggregatorAxis,
  type AggregatorOptions,
  type AxisSourceTrust,
  type EvidenceAggregator,
  type RecencyBands,
  type SourceTrust,
} from "./types.ts";

const M_PER_DEG = 111_320;
const YEAR_MS = 365.25 * 24 * 3600 * 1000;

/** v1 vision axes (spec 103): streetFurniture is OSM-only in v1. */
const VISION_AXES: readonly AggregatorAxis[] = [
  "facadeColors",
  "facadeMaterials",
  "roofTypes",
  "sidewalkTypes",
  "roadSurfaces",
  "vegetation",
  "urbanCharacter",
];

const ALL_AXES: readonly AggregatorAxis[] = [...VISION_AXES, "streetFurniture"];

function observationField(obs: VisualObservation, axis: AggregatorAxis): ClassificationResult<string> | undefined {
  switch (axis) {
    case "facadeColors": return obs.facadeColor as ClassificationResult<string> | undefined;
    case "facadeMaterials": return obs.facadeMaterial as ClassificationResult<string> | undefined;
    case "roofTypes": return obs.roofType as ClassificationResult<string> | undefined;
    case "sidewalkTypes": return obs.sidewalkType as ClassificationResult<string> | undefined;
    case "roadSurfaces": return obs.roadSurface as ClassificationResult<string> | undefined;
    case "vegetation": return obs.vegetationCharacter as ClassificationResult<string> | undefined;
    case "urbanCharacter": return obs.urbanCharacter as ClassificationResult<string> | undefined;
    case "streetFurniture": return obs.streetFurnitureCharacter as ClassificationResult<string> | undefined;
  }
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Spec 37: newer = stronger, old is never invalid. Missing date -> neutral. */
function recencyWeight(capturedAt: string | undefined, retrievedAt: string, bands: RecencyBands): number {
  if (capturedAt === undefined) return 1.0;
  const captured = Date.parse(capturedAt);
  const retrieved = Date.parse(retrievedAt);
  if (Number.isNaN(captured) || Number.isNaN(retrieved)) return 1.0;
  const years = (retrieved - captured) / YEAR_MS;
  const [t1, t2, t3] = bands.thresholdsYears;
  const [w1, w2, w3, w4] = bands.weights;
  if (years < 0) return w1; // future-dated (clock skew): treat as newest, never punish
  if (years < t1) return w1;
  if (years < t2) return w2;
  if (years < t3) return w3;
  return w4;
}

function distanceM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = (aLat - bLat) * M_PER_DEG;
  const dLon = (aLon - bLon) * M_PER_DEG * Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  return Math.hypot(dLat, dLon);
}

/**
 * Spec 38: many photos from the same street must not dominate. Each sample's
 * weight is damped by 1/sqrt(k) where k is the number of samples within the
 * cluster radius of it (itself included). Isolated samples keep full weight.
 */
function spatialWeights(samples: readonly StreetSample[], clusterMeters: number): Map<string, number> {
  const weights = new Map<string, number>();
  for (const s of samples) {
    if (weights.has(s.sourceId)) continue;
    let k = 0;
    for (const other of samples) {
      if (distanceM(s.latitude, s.longitude, other.latitude, other.longitude) < clusterMeters) k += 1;
    }
    weights.set(s.sourceId, 1 / Math.sqrt(Math.max(1, k)));
  }
  return weights;
}

interface VisionAggregation {
  readonly scores: Readonly<Record<string, number>>;
  readonly dominant?: string;
  readonly confidence: number;
  readonly contributing: number;
}

/**
 * Vision part of one axis (spec 36): weight = modelConfidence x quality x
 * recency x spatial x sourceTrust(vision) — the trust factor is applied at
 * blend time so the per-axis table stays the single source of truth.
 */
function aggregateVisionAxis(
  observations: readonly VisualObservation[],
  axis: AggregatorAxis,
  recencyOf: (obs: VisualObservation) => number,
  spatialOf: (obs: VisualObservation) => number,
): VisionAggregation {
  const raw: Record<string, number> = {};
  let contributing = 0;
  for (const obs of observations) {
    if (obs.quality <= 0) continue; // fallback observations contribute nothing
    const result = observationField(obs, axis);
    if (result === undefined || result.confidence <= 0) continue;
    const weight = result.confidence * obs.quality * recencyOf(obs) * spatialOf(obs);
    if (weight <= 0) continue;
    raw[result.value] = (raw[result.value] ?? 0) + weight;
    contributing += 1;
  }
  const total = Object.values(raw).reduce<number>((sum, v) => sum + v, 0);
  if (total <= 0 || contributing === 0) return { scores: {}, confidence: 0, contributing: 0 };
  const scores: Record<string, number> = {};
  let dominant: string | undefined;
  let best = 0;
  for (const [cls, w] of Object.entries(raw).sort(([a], [b]) => a.localeCompare(b))) {
    scores[cls] = round4(w / total);
    if (w > best) {
      best = w;
      dominant = cls;
    }
  }
  // Documented confidence formula: dominance squared (a tie is weak evidence)
  // x evidence volume capped at VISION_CONFIDENCE_SAMPLE_CAP observations
  // (more agreeing photos do not make the class more true).
  const dominantScore = best / total;
  const confidence = clamp01(dominantScore * dominantScore * Math.min(1, contributing / VISION_CONFIDENCE_SAMPLE_CAP));
  return { scores, dominant, confidence: round4(confidence), contributing };
}

/**
 * Blend OSM and vision for one axis (spec 40: OSM explicit tag > street
 * imagery > inheritance). Source weights are confidence x per-axis trust
 * (spec 130), so an untagged OSM (confidence 0) never outranks vision and
 * an explicit OSM tag outranks conflicting imagery. On an exact score tie
 * the priority source (OSM) wins.
 */
function blendAxis(osm: Distribution<string> | undefined, vision: VisionAggregation, trust: AxisSourceTrust): Distribution<string> {
  const wOsm = (osm?.confidence ?? 0) * trust.osm;
  const wVis = vision.confidence * trust.vision;
  const total = wOsm + wVis;
  if (total <= 0) return { scores: {}, confidence: 0 };

  const osmScores = (osm?.scores ?? {}) as Record<string, number | undefined>;
  const classes = new Set<string>([...Object.keys(osmScores), ...Object.keys(vision.scores)]);
  const raw: Record<string, number> = {};
  for (const cls of classes) {
    const value = (wOsm * (osmScores[cls] ?? 0) + wVis * (vision.scores[cls] ?? 0)) / total;
    if (value > 0) raw[cls] = value;
  }
  const sum = Object.values(raw).reduce<number>((acc, v) => acc + v, 0);
  const scores: Record<string, number> = {};
  let dominant: string | undefined;
  let best = -1;
  for (const [cls, v] of Object.entries(raw).sort(([a], [b]) => a.localeCompare(b))) {
    const score = round4(v / sum);
    if (score > 0) scores[cls] = score;
    if (dominant === undefined) {
      dominant = cls;
      best = v;
    } else if (v > best + 1e-12) {
      dominant = cls;
      best = v;
    } else if (Math.abs(v - best) <= 1e-12) {
      // exact tie -> the priority source (OSM) wins (spec 40)
      dominant = osm?.dominant ?? dominant;
    }
  }
  // keep the scores summing to ~1 after rounding
  const drift = round4(1 - Object.values(scores).reduce<number>((acc, v) => acc + (v ?? 0), 0));
  if (drift !== 0 && dominant) scores[dominant] = round4((scores[dominant] ?? 0) + drift);
  const confidence = round4((wOsm * (osm?.confidence ?? 0) + wVis * vision.confidence) / total);
  return { scores, dominant, confidence };
}

/** Detections that stylize a density (vehicle is deliberately NOT parked). */
const DETECTION_DENSITY: Readonly<Record<string, keyof ObservedDensities>> = {
  tree: "tree",
  bench: "bench",
  bollard: "bollard",
  "street-light": "streetLight",
};

function mergeDensities(osm: ObservedDensities | undefined, samples: readonly StreetSample[]): ObservedDensities {
  const counts: Record<keyof ObservedDensities, number> = { tree: 0, streetLight: 0, bench: 0, bollard: 0, parkedVehicle: 0 };
  for (const s of samples) {
    for (const d of s.detections ?? []) {
      const key = DETECTION_DENSITY[d.canonicalClass];
      if (key) counts[key] += 1;
    }
  }
  const merged: Record<keyof ObservedDensities, number> = { tree: 0, streetLight: 0, bench: 0, bollard: 0, parkedVehicle: 0 };
  for (const key of Object.keys(counts) as Array<keyof ObservedDensities>) {
    const fromImagery = 1 - Math.exp(-counts[key] / 10);
    const fromOsm = osm?.[key] ?? 0;
    // union (probability-style): either source seeing it is evidence
    merged[key] = round4(1 - (1 - fromOsm) * (1 - fromImagery));
  }
  return merged;
}

/** 4x4 grid coverage of the cell by sample positions. */
function gridSpatialCoverage(cell: SpatialCell, samples: readonly StreetSample[]): number {
  if (samples.length === 0) return 0;
  const occupied = new Set<string>();
  for (const s of samples) {
    if (s.latitude < cell.bounds.south || s.latitude > cell.bounds.north || s.longitude < cell.bounds.west || s.longitude > cell.bounds.east) continue;
    const row = Math.min(3, Math.floor(((s.latitude - cell.bounds.south) / (cell.bounds.north - cell.bounds.south)) * 4));
    const col = Math.min(3, Math.floor(((s.longitude - cell.bounds.west) / (cell.bounds.east - cell.bounds.west)) * 4));
    occupied.add(`${row}:${col}`);
  }
  return occupied.size / 16;
}

function directionalCoverage(samples: readonly StreetSample[]): number {
  const quadrants = new Set<number>();
  for (const s of samples) {
    if (s.heading === undefined || !Number.isFinite(s.heading)) continue;
    const h = ((s.heading % 360) + 360) % 360;
    quadrants.add(Math.floor(h / 90));
  }
  return quadrants.size / 4;
}

function canonicalObservation(obs: VisualObservation): string {
  const parts: string[] = [];
  for (const axis of ALL_AXES) {
    const result = observationField(obs, axis);
    parts.push(result === undefined ? `${axis}=-` : `${axis}=${result.value}:${round4(result.confidence)}`);
  }
  return `${obs.sampleId}|${parts.join(",")}|q:${round4(obs.quality)}`;
}

function canonicalSample(s: StreetSample): string {
  const detections = (s.detections ?? []).map((d) => d.canonicalClass).sort().join("+");
  return `${s.sourceId}:${detections}`;
}

/**
 * Evidence aggregator (VPS-08, spec 104, 33-42, 130): merges OSM evidence,
 * vision observations and imagery detections into one
 * VisualEvidenceProfile per cell. Pure and deterministic: recency is
 * relative to the injected retrievedAt, no clock, no Math.random.
 */
export function aggregateEvidence(input: AggregationInput, options: AggregatorOptions = {}): VisualEvidenceProfile {
  const trust: SourceTrust = options.trust ?? DEFAULT_SOURCE_TRUST;
  const recency: RecencyBands = options.recency ?? DEFAULT_RECENCY_BANDS;
  const clusterMeters = options.spatialClusterMeters ?? DEFAULT_SPATIAL_CLUSTER_METERS;

  const observations = input.observations;
  const samples = input.samples ?? [];
  const osm = input.osmEvidence;

  const spatial = spatialWeights(samples, clusterMeters);
  const recencyOf = (obs: VisualObservation) => recencyWeight(obs.provenance.capturedAt, input.retrievedAt, recency);
  const spatialOf = (obs: VisualObservation) => spatial.get(obs.sampleId) ?? 1.0;

  const distributions = {} as Record<AggregatorAxis, Distribution<string>>;
  for (const axis of ALL_AXES) {
    const vision = VISION_AXES.includes(axis)
      ? aggregateVisionAxis(observations, axis, recencyOf, spatialOf)
      : { scores: {}, confidence: 0, contributing: 0 };
    distributions[axis] = blendAxis(osm?.[axis] as Distribution<string> | undefined, vision, trust[axis]);
  }

  const usable = observations.filter((o) => o.quality > 0);
  const imageryConfidence = round4(
    VISION_AXES.reduce<number>((sum, axis) => sum + (distributions[axis].confidence ?? 0), 0) / VISION_AXES.length,
  );
  const osmConfidence = osm ? osm.coverage.osmConfidence : 0;
  const presentSources: number[] = [];
  if (osm !== undefined) presentSources.push(osmConfidence);
  if (usable.length > 0) presentSources.push(imageryConfidence);
  const overall = presentSources.length > 0 ? round4(presentSources.reduce<number>((a, b) => a + b, 0) / presentSources.length) : 0;

  const osmSpatial = osm ? osm.coverage.spatialCoverage : 0;
  const spatialCoverage = round4(Math.max(osmSpatial, gridSpatialCoverage(input.cell, samples)));

  const captured: string[] = [];
  for (const s of samples) {
    if (s.capturedAt !== undefined && !Number.isNaN(Date.parse(s.capturedAt))) captured.push(s.capturedAt);
  }
  if (captured.length === 0) {
    for (const o of usable) {
      if (o.provenance.capturedAt !== undefined && !Number.isNaN(Date.parse(o.provenance.capturedAt))) captured.push(o.provenance.capturedAt);
    }
  }
  captured.sort();

  const providers = new Set<string>();
  if (osm !== undefined) providers.add("osm");
  for (const s of samples) providers.add(s.provenance.provider);
  if (providers.size === 0) providers.add("none");

  const sortedObs = [...usable].sort((a, b) => a.sampleId.localeCompare(b.sampleId));
  const sortedSamples = [...samples].sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  const canonical = [
    input.cell.id,
    osm?.evidenceRevision ?? "-",
    ...sortedObs.map(canonicalObservation),
    ...sortedSamples.map(canonicalSample),
    String(input.requestedSamples),
    JSON.stringify({
      t: {
        [VISION_AXES[0] as string]: trust[VISION_AXES[0] as AggregatorAxis],
      },
      r: recency.thresholdsYears.join(","),
      c: String(clusterMeters),
    }),
  ].join("|");
  const evidenceRevision = `agg:v1:a${ANALYZER_REVISION}:${(stableStringHash(canonical) >>> 0).toString(16).padStart(8, "0")}`;

  return {
    schemaVersion: 1,
    cell: input.cell,
    evidenceRevision,
    facadeColors: distributions.facadeColors as VisualEvidenceProfile["facadeColors"],
    facadeMaterials: distributions.facadeMaterials as VisualEvidenceProfile["facadeMaterials"],
    roofTypes: distributions.roofTypes as VisualEvidenceProfile["roofTypes"],
    sidewalkTypes: distributions.sidewalkTypes as VisualEvidenceProfile["sidewalkTypes"],
    roadSurfaces: distributions.roadSurfaces as VisualEvidenceProfile["roadSurfaces"],
    vegetation: distributions.vegetation as VisualEvidenceProfile["vegetation"],
    urbanCharacter: distributions.urbanCharacter as VisualEvidenceProfile["urbanCharacter"],
    streetFurniture: distributions.streetFurniture as VisualEvidenceProfile["streetFurniture"],
    observedDensities: mergeDensities(osm?.observedDensities, samples),
    coverage: {
      requestedSamples: input.requestedSamples,
      usableSamples: usable.length,
      spatialCoverage,
      directionalCoverage: round4(directionalCoverage(samples)),
      imageryConfidence,
      osmConfidence,
      overall,
    },
    provenanceSummary: {
      providers: [...providers].sort(),
      sampleCount: usable.length,
      earliestCapturedAt: captured[0],
      latestCapturedAt: captured.length > 0 ? captured[captured.length - 1] : undefined,
      retrievedAt: input.retrievedAt,
    },
  };
}

export function createEvidenceAggregator(options: AggregatorOptions = {}): EvidenceAggregator {
  return {
    aggregate(input: AggregationInput): VisualEvidenceProfile {
      return aggregateEvidence(input, options);
    },
  };
}
