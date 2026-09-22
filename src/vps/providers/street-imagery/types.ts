/**
 * Provider-neutral street-imagery contracts (VPS-06, spec 5, 8-9, 13-16, 31-32,
 * 80-83). The rest of the VPS depends only on StreetImageryProvider, never on
 * Mapillary (spec 5). No provider payload, credential or URL shape leaks
 * into these types: adapters translate provider data into them, and the
 * service (VPS-10) is the only layer that may hold credentials or issue
 * network calls (spec 82-83).
 */
import type { GeoBounds, GeoPoint } from "../../evidence/types.ts";

/** Any area the service can sample; a SpatialCell is structurally a GeoArea. */
export interface GeoArea {
  readonly id: string;
  readonly center: GeoPoint;
  readonly bounds: GeoBounds;
}

/** Sampling knobs (spec 13); baseline radius 400 m, 20-30 samples. */
export interface StreetSamplingOptions {
  readonly radiusMeters: number;
  readonly maxSamples: number;
  readonly preferredRecencyYears?: number;
  readonly minDirectionalSpread?: number;
}

/** Provenance is not optional by design (spec 16). */
export interface EvidenceProvenance {
  readonly provider: string;
  readonly sourceId?: string;
  readonly sourceUrl?: string;
  readonly capturedAt?: string;
  readonly license?: string;
  readonly attribution?: string;
  readonly retrievedAt: string;
}

/**
 * Provider detection mapped into the internal contract (spec 31-32).
 * canonicalClass is the VPS name; providerClass keeps the vendor name for
 * debugging. Unknown vendor classes pass through as their own canonical
 * class — never assumed, never dropped silently.
 */
export interface ProviderDetection {
  readonly canonicalClass: string;
  readonly providerClass: string;
  readonly confidence?: number;
  readonly provenance: EvidenceProvenance;
}

/** One street-level observation, provider-neutral (spec 15). */
export interface StreetSample {
  readonly provider: string;
  readonly sourceId: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly capturedAt?: string;
  readonly heading?: number;
  readonly imageUrl?: string;
  readonly detections?: readonly ProviderDetection[];
  readonly provenance: EvidenceProvenance;
}

export interface StreetSampleBatch {
  readonly provider: string;
  readonly area: GeoArea;
  readonly options: StreetSamplingOptions;
  readonly requested: number;
  readonly samples: readonly StreetSample[];
  readonly retrievedAt: string;
}

export interface StreetImageryProvider {
  /**
   * Sample street imagery in an area (spec 5, 8-9, 13-14). Implementations:
   * MapillaryImageryProvider, TestImageryProvider, ... Failures must surface
   * as StreetImageryProviderError so the service can degrade to OSM-only
   * evidence and then the LVP parent (spec 80).
   */
  sample(area: GeoArea, options: StreetSamplingOptions, retrievedAt: string): Promise<StreetSampleBatch>;
}

/** Typed failure so the service degrades deterministically (spec 80). */
export class StreetImageryProviderError extends Error {
  readonly kind: "rate-limited" | "unavailable" | "auth" | "invalid-response";

  constructor(kind: "rate-limited" | "unavailable" | "auth" | "invalid-response", message: string) {
    super(message);
    this.name = "StreetImageryProviderError";
    this.kind = kind;
  }
}
