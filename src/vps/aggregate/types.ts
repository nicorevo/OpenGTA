/**
 * Evidence aggregation contracts (VPS-08, spec 33-42, 104, 116, 130).
 *
 * The aggregator merges OSM evidence, vision observations and imagery
 * detections into ONE VisualEvidenceProfile per cell, with confidence and
 * per-attribute source trust (spec 130: configurable per axis, never one
 * global trust). Pure and deterministic: no clock (recency is relative to
 * the injected retrievedAt), no Math.random, same input -> same output.
 */
import type { SpatialCell, VisualEvidenceProfile } from "../evidence/types.ts";
import type { StreetSample } from "../providers/street-imagery/types.ts";
import type { VisualObservation } from "../analysis/types.ts";

/** The eight distribution axes of a VisualEvidenceProfile. */
export type AggregatorAxis =
  | "facadeColors"
  | "facadeMaterials"
  | "roofTypes"
  | "sidewalkTypes"
  | "roadSurfaces"
  | "vegetation"
  | "urbanCharacter"
  | "streetFurniture";

export interface AxisSourceTrust {
  /** Trust for this axis when it comes from OSM (spec 130). */
  readonly osm: number;
  /** Trust for this axis when it comes from street imagery / vision. */
  readonly vision: number;
}

/** Per-attribute trust table (spec 130: configurable per attribute). */
export type SourceTrust = Readonly<Record<AggregatorAxis, AxisSourceTrust>>;

/**
 * Default trust (spec 130 examples + documented defaults for the other
 * axes). OSM is only trusted where it is explicit and reliable (building
 * material/roof/colour); imagery is trusted more for appearance and
 * character, less for what OSM encodes explicitly.
 */
export const DEFAULT_SOURCE_TRUST: SourceTrust = {
  facadeColors: { osm: 1.0, vision: 0.9 },
  facadeMaterials: { osm: 1.0, vision: 0.8 },
  roofTypes: { osm: 1.0, vision: 0.8 },
  sidewalkTypes: { osm: 0.8, vision: 0.9 },
  roadSurfaces: { osm: 0.9, vision: 0.8 },
  vegetation: { osm: 0.6, vision: 0.8 },
  urbanCharacter: { osm: 0.5, vision: 0.8 },
  streetFurniture: { osm: 0.6, vision: 0.8 },
};

/** Recency bands (spec 37): newer = stronger, old is never invalid. */
export interface RecencyBands {
  /** Upper bounds of the first three bands, in years. */
  readonly thresholdsYears: readonly [number, number, number];
  /** Weights for: < t1, t1..t2, t2..t3, > t3. */
  readonly weights: readonly [number, number, number, number];
}

/** Spec 37 initial example. */
export const DEFAULT_RECENCY_BANDS: RecencyBands = {
  thresholdsYears: [2, 5, 8],
  weights: [1.0, 0.85, 0.65, 0.45],
};

/**
 * Spatial cluster radius (spec 38): observations closer than this to each
 * other form a cluster whose total contribution is damped (weight
 * 1/sqrt(clusterSize) per member) so many photos from the same street do
 * not dominate. Default matches the sampling spread.
 */
export const DEFAULT_SPATIAL_CLUSTER_METERS = 30;

/**
 * Vision confidence volume cap (documented decision): more than two
 * agreeing observations do not raise confidence — the dominance of the
 * winning class does (see aggregate.ts). Keeps "100 photos of one street"
 * from reading as stronger evidence than reality.
 */
export const VISION_CONFIDENCE_SAMPLE_CAP = 2;

export interface AggregationInput {
  readonly cell: SpatialCell;
  /** OSM evidence for the cell, if any (spec 42: vision-only is a real case). */
  readonly osmEvidence?: VisualEvidenceProfile;
  /** Validated vision observations (spec 115 fixtures are acceptable). */
  readonly observations: readonly VisualObservation[];
  /** Selected samples: detections, positions and headings (spec 38, 92-93). */
  readonly samples?: readonly StreetSample[];
  /** How many samples the provider was asked for (spec 39). */
  readonly requestedSamples: number;
  /** Service wall-clock; recency and provenance are relative to it. */
  readonly retrievedAt: string;
}

export interface AggregatorOptions {
  readonly trust?: SourceTrust;
  readonly recency?: RecencyBands;
  readonly spatialClusterMeters?: number;
}

export interface EvidenceAggregator {
  aggregate(input: AggregationInput): VisualEvidenceProfile;
}

/**
 * Aggregator revision (spec 57, 116): part of the evidence identity. A new
 * aggregator version changes the merged evidence, so it must appear in
 * evidenceRevision (see aggregate.ts revision format).
 */
export const AGGREGATOR_REVISION = 1;
