import type {
  FacadeColorClass,
  FacadeMaterialClass,
  RoadSurfaceClass,
  RoofTypeClass,
  SidewalkTypeClass,
  UrbanCharacterClass,
  VegetationClass,
} from "../evidence/types.ts";
import type { StreetSample } from "../providers/street-imagery/types.ts";
import type { ClassificationResult, VisualObservation } from "./types.ts";

/**
 * Strict validation of raw analyzer output (spec 30, 78):
 * - closed schema, extra fields rejected (no partial acceptance);
 * - closed vocabularies, unknown values rejected (spec 21);
 * - confidences and quality clamped to 0..1 (spec 20);
 * - size limit on the raw payload (spec 78);
 * - anything else -> fallbackObservation ("fallback unknown", spec 30).
 * Pure and deterministic: provenance comes from the sample, never a clock.
 */

/** Max serialized bytes of a raw analyzer payload (spec 78 size limits). */
export const MAX_ANALYZER_OUTPUT_BYTES = 16_384;

/**
 * v1 scope (spec 103): seven axes; streetFurnitureCharacter is not included.
 * Exported so the server-side model prompt (VPS-11) can enumerate the same
 * closed vocabularies the validator enforces — no drift between what the
 * model is told and what is accepted (spec 21).
 */
export const AXIS_VOCABULARIES = {
  facadeColor: [
    "white", "cream", "sand", "ochre", "terracotta", "red", "brown",
    "warm-grey", "cool-grey", "dark", "mixed", "unknown",
  ] as readonly FacadeColorClass[],
  facadeMaterial: [
    "plaster", "stone", "brick", "concrete", "glass", "metal", "wood",
    "mixed", "unknown",
  ] as readonly FacadeMaterialClass[],
  roofType: [
    "terracotta-tile", "red-tile", "dark-tile", "slate", "zinc", "metal",
    "flat-concrete", "green-roof", "mixed", "unknown",
  ] as readonly RoofTypeClass[],
  sidewalkType: [
    "light-stone", "warm-stone", "dark-stone", "concrete", "pavers",
    "brick", "asphalt", "mixed", "unknown",
  ] as readonly SidewalkTypeClass[],
  roadSurface: [
    "asphalt", "concrete", "cobblestone", "pavers", "gravel", "dirt",
    "mixed", "unknown",
  ] as readonly RoadSurfaceClass[],
  vegetationCharacter: [
    "mediterranean-urban", "temperate-urban", "continental-urban",
    "tropical-urban", "arid-urban", "sparse", "mixed", "unknown",
  ] as readonly VegetationClass[],
  urbanCharacter: [
    "historic-dense", "historic-medium", "modern-dense", "modern-medium",
    "residential-lowrise", "suburban", "industrial", "commercial",
    "mixed", "unknown",
  ] as readonly UrbanCharacterClass[],
} as const;

type AxisName = keyof typeof AXIS_VOCABULARIES;

const ALLOWED_KEYS: ReadonlySet<string> = new Set<string>([
  "sampleId",
  "quality",
  ...(Object.keys(AXIS_VOCABULARIES) as readonly AxisName[]),
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * A failed analysis must not pollute the aggregation: no axes, zero
 * quality. The aggregator (VPS-08) skips zero-quality observations, so an
 * unvalidated payload contributes exactly nothing (spec 30: never accept
 * unvalidated output).
 */
export function fallbackObservation(sample: StreetSample): VisualObservation {
  return {
    sampleId: sample.sourceId,
    quality: 0,
    provenance: sample.provenance,
  };
}

function parseAxis(raw: unknown, vocabulary: readonly string[]): ClassificationResult<string> | undefined {
  if (!isPlainObject(raw)) return undefined;
  const keys = Object.keys(raw);
  if (keys.length !== 2 || !keys.includes("value") || !keys.includes("confidence")) return undefined;
  const value = raw.value;
  const confidence = raw.confidence;
  if (typeof value !== "string" || !vocabulary.includes(value)) return undefined;
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) return undefined;
  return { value, confidence: clamp01(confidence) };
}

export function validateVisualObservation(raw: unknown, sample: StreetSample): VisualObservation {
  if (!isPlainObject(raw)) return fallbackObservation(sample);
  try {
    if (JSON.stringify(raw).length > MAX_ANALYZER_OUTPUT_BYTES) return fallbackObservation(sample);
  } catch {
    return fallbackObservation(sample);
  }

  for (const key of Object.keys(raw)) {
    if (!ALLOWED_KEYS.has(key)) return fallbackObservation(sample);
  }

  const sampleId = raw.sampleId;
  if (typeof sampleId !== "string" || sampleId.length === 0 || sampleId !== sample.sourceId) {
    return fallbackObservation(sample);
  }

  const quality = raw.quality;
  if (typeof quality !== "number" || !Number.isFinite(quality)) return fallbackObservation(sample);

  const observation: VisualObservation = {
    sampleId,
    quality: clamp01(quality),
    provenance: sample.provenance,
  };

  for (const axis of Object.keys(AXIS_VOCABULARIES) as AxisName[]) {
    if (raw[axis] === undefined) continue;
    const parsed = parseAxis(raw[axis], AXIS_VOCABULARIES[axis]);
    if (parsed === undefined) return fallbackObservation(sample);
    (observation as unknown as Record<string, unknown>)[axis] = parsed;
  }

  return observation;
}
