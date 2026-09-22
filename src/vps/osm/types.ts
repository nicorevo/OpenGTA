/**
 * Provider-neutral OSM input for the evidence collector (VPS-05, spec 101).
 * The core never sees provider payloads: the service layer (VPS-10) turns
 * Overpass/query results into these minimal tagged geometries.
 */
import type { SpatialCell, VisualEvidenceProfile } from "../evidence/types.ts";

export interface OsmNode {
  readonly tags: Readonly<Record<string, string>>;
}

export interface OsmWay {
  readonly tags: Readonly<Record<string, string>>;
  readonly lengthM: number;
}

export interface OsmArea {
  readonly tags: Readonly<Record<string, string>>;
  readonly areaM2: number;
}

export interface OsmCellFeatures {
  readonly nodes: readonly OsmNode[];
  readonly ways: readonly OsmWay[];
  readonly areas: readonly OsmArea[];
}

export interface OsmEvidenceCollector {
  /**
   * Pure: same input -> same VisualEvidenceProfile (spec 116). retrievedAt
   * is injected by the service so the core stays wall-clock free.
   */
  collect(features: OsmCellFeatures, cell: SpatialCell, retrievedAt: string): VisualEvidenceProfile;
}
