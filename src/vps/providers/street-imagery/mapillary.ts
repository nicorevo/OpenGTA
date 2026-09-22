import { selectStreetSamples } from "./sampling.ts";
import { StreetImageryProviderError } from "./types.ts";
import type {
  GeoArea,
  ProviderDetection,
  StreetImageryProvider,
  StreetSample,
  StreetSampleBatch,
  StreetSamplingOptions,
} from "./types.ts";

export const MAPILLARY_PROVIDER_NAME = "mapillary";

/**
 * Server-side only (spec 82-83): the MapillaryClient is the single layer that
 * holds credentials and talks to Mapillary. The browser never sees it. Known
 * failure modes must be thrown as StreetImageryProviderError so the service
 * degrades deterministically to OSM-only evidence and then the LVP parent
 * (spec 80).
 */
export interface MapillaryImageRef {
  readonly imageId: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly capturedAt?: string;
  readonly compassAngle?: number;
  readonly thumbnailUrl?: string;
  readonly seqId?: string;
}

export interface MapillaryDetectionRef {
  readonly tag: string;
  readonly score?: number;
}

export interface MapillaryClient {
  searchImages(area: GeoArea, radiusMeters: number): Promise<MapillaryImageRef[]>;
  fetchDetections?(imageId: string): Promise<MapillaryDetectionRef[]>;
}

/**
 * Starting mapping of Mapillary detection tags to canonical classes (spec 31:
 * map provider classes into the internal contract, never assume exact names
 * without verifying the current API). Unknown tags pass through unchanged so
 * nothing is silently dropped; the table must be re-verified against the live
 * API when the service is wired in VPS-10.
 */
const KNOWN_CLASS_MAP: Readonly<Record<string, string>> = {
  tree: "tree",
  streetlight: "street-light",
  street_light: "street-light",
  bollard: "bollard",
  bench: "bench",
  traffic_sign: "traffic-sign",
  traffic_light: "traffic-light",
  vehicle: "vehicle",
  crosswalk: "crosswalk",
};

function toCandidate(ref: MapillaryImageRef, retrievedAt: string): StreetSample | undefined {
  const validId = typeof ref.imageId === "string" && ref.imageId.length > 0;
  const validPos =
    Number.isFinite(ref.latitude) && ref.latitude >= -90 && ref.latitude <= 90 &&
    Number.isFinite(ref.longitude) && ref.longitude >= -180 && ref.longitude <= 180;
  if (!validId || !validPos) return undefined;

  const capturedAt =
    typeof ref.capturedAt === "string" && !Number.isNaN(Date.parse(ref.capturedAt)) ? ref.capturedAt : undefined;
  const heading =
    typeof ref.compassAngle === "number" && Number.isFinite(ref.compassAngle)
      ? ((ref.compassAngle % 360) + 360) % 360
      : undefined;
  const imageUrl = typeof ref.thumbnailUrl === "string" && ref.thumbnailUrl.length > 0 ? ref.thumbnailUrl : undefined;

  return {
    provider: MAPILLARY_PROVIDER_NAME,
    sourceId: ref.imageId,
    latitude: ref.latitude,
    longitude: ref.longitude,
    capturedAt,
    heading,
    imageUrl,
    // spec 17: no license string is encoded here — licensing must be verified
    // before production and then supplied by the service, not assumed.
    provenance: {
      provider: MAPILLARY_PROVIDER_NAME,
      sourceId: ref.imageId,
      sourceUrl: imageUrl,
      capturedAt,
      attribution: "Mapillary contributors",
      retrievedAt,
    },
  };
}

function toDetection(ref: MapillaryDetectionRef, sourceId: string, retrievedAt: string): ProviderDetection | undefined {
  if (typeof ref.tag !== "string" || ref.tag.length === 0) return undefined;
  const confidence =
    typeof ref.score === "number" && Number.isFinite(ref.score) && ref.score >= 0 && ref.score <= 1 ? ref.score : undefined;
  return {
    canonicalClass: KNOWN_CLASS_MAP[ref.tag] ?? ref.tag,
    providerClass: ref.tag,
    confidence,
    provenance: { provider: MAPILLARY_PROVIDER_NAME, sourceId, retrievedAt },
  };
}

/**
 * Mapillary adapter (VPS-06, spec 5, 102): area -> sampled StreetSampleBatch.
 * No analyzer here (spec 102): it maps, samples and attaches provenance.
 * Rate limiting, auth and HTTP belong to the injected MapillaryClient.
 */
export function createMapillaryProvider(client: MapillaryClient): StreetImageryProvider {
  return {
    async sample(area: GeoArea, options: StreetSamplingOptions, retrievedAt: string): Promise<StreetSampleBatch> {
      let refs: MapillaryImageRef[];
      try {
        refs = await client.searchImages(area, options.radiusMeters);
      } catch (err) {
        if (err instanceof StreetImageryProviderError) throw err;
        throw new StreetImageryProviderError("unavailable", `mapillary search failed: ${errMessage(err)}`);
      }
      if (!Array.isArray(refs)) {
        throw new StreetImageryProviderError("invalid-response", "mapillary searchImages must resolve to an array");
      }
      const candidates: StreetSample[] = [];
      for (const ref of refs) {
        const candidate = toCandidate(ref, retrievedAt);
        if (candidate) candidates.push(candidate);
      }
      if (refs.length > 0 && candidates.length === 0) {
        throw new StreetImageryProviderError("invalid-response", "mapillary returned only invalid image references");
      }

      const selected = selectStreetSamples(candidates, options, area);
      const samples =
        selected.length > 0 && client.fetchDetections !== undefined
          ? await attachDetections(selected, client, retrievedAt)
          : selected;

      return {
        provider: MAPILLARY_PROVIDER_NAME,
        area,
        options,
        requested: options.maxSamples,
        samples,
        retrievedAt,
      };
    },
  };
}

/** Detections are fetched only for selected samples (spec 8: no indiscriminate download). */
async function attachDetections(
  selected: readonly StreetSample[],
  client: MapillaryClient,
  retrievedAt: string,
): Promise<StreetSample[]> {
  return Promise.all(
    selected.map(async (s): Promise<StreetSample> => {
      try {
        const refs = await client.fetchDetections!(s.sourceId);
        if (!Array.isArray(refs)) return s;
        const detections: ProviderDetection[] = [];
        for (const ref of refs) {
          const detection = toDetection(ref, s.sourceId, retrievedAt);
          if (detection) detections.push(detection);
        }
        return detections.length > 0 ? { ...s, detections } : s;
      } catch {
        // A per-image detection failure degrades to "no detections" (spec 80):
        // the imagery evidence itself is still valid.
        return s;
      }
    }),
  );
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
