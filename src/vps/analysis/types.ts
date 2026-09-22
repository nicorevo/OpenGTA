/**
 * Visual analysis contracts (VPS-07, spec 18-21, 30, 78, 103, 115).
 *
 * The VisualAnalyzer turns ONE street sample into ONE structured observation
 * over the closed vocabularies. It must not emit free text as primary output
 * (spec 18) and must never invent categories (spec 21). The concrete model
 * integration is server-side (VPS-10); everything in this directory is pure
 * and deterministic — no network, no clock, no credentials.
 */
import type {
  FacadeColorClass,
  FacadeMaterialClass,
  RoadSurfaceClass,
  RoofTypeClass,
  SidewalkTypeClass,
  StreetFurnitureClass,
  UrbanCharacterClass,
  VegetationClass,
} from "../evidence/types.ts";
import type { EvidenceProvenance, StreetSample } from "../providers/street-imagery/types.ts";

export interface ClassificationResult<T extends string> {
  readonly value: T;
  /** 0..1, clamped by the validator (spec 20). */
  readonly confidence: number;
}

/**
 * One structured observation of one sample (spec 19). All classification
 * axes are optional: an absent axis means "not observed", which the
 * aggregator (VPS-08) must treat differently from a low-confidence guess.
 */
export interface VisualObservation {
  readonly sampleId: string;
  readonly facadeColor?: ClassificationResult<FacadeColorClass>;
  readonly facadeMaterial?: ClassificationResult<FacadeMaterialClass>;
  readonly roofType?: ClassificationResult<RoofTypeClass>;
  readonly sidewalkType?: ClassificationResult<SidewalkTypeClass>;
  readonly roadSurface?: ClassificationResult<RoadSurfaceClass>;
  readonly vegetationCharacter?: ClassificationResult<VegetationClass>;
  readonly urbanCharacter?: ClassificationResult<UrbanCharacterClass>;
  /** Present in the spec schema; out of scope for the v1 analyzer (spec 103). */
  readonly streetFurnitureCharacter?: ClassificationResult<StreetFurnitureClass>;
  /** 0..1 usability of this observation for aggregation. */
  readonly quality: number;
  readonly provenance: EvidenceProvenance;
}

export interface VisualAnalyzer {
  /**
   * Analyze one selected sample (spec 18). Implementations must never accept
   * unvalidated model output: raw payloads go through the strict validator
   * (spec 30, 78) before an observation exists.
   */
  analyze(sample: StreetSample): Promise<VisualObservation>;
}

/**
 * Analyzer revision (spec 57, 116): part of the evidence identity. A new
 * analyzer version changes observations, so it must be visible in
 * evidenceRevision so cached evidence is not silently mixed.
 */
export const ANALYZER_REVISION = 1;
