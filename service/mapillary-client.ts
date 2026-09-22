import { StreetImageryProviderError } from "../src/vps/index.ts";
import type { GeoArea, MapillaryClient, MapillaryDetectionRef, MapillaryImageRef } from "../src/vps/index.ts";
import type { RateLimiter } from "./rate-limit.ts";

/**
 * Mapillary client for the CURRENT public API (VPS-10, spec 82-83).
 *
 * Live recon 2026-09-22 (the documented v1 REST API is gone; api.mapillary.com
 * is NXDOMAIN):
 *   base        https://graph.mapillary.com   (no /v1 prefix)
 *   auth        Authorization: Bearer <client credential>
 *   search      GET /images?bbox=w,s,e,n&limit=N&fields=compass_angle,captured_at,thumb_2048_url,geometry
 *               (lat/lng+radius is also accepted, radius capped at 50 m —
 *               the bbox form covers a whole cell in one call)
 *   item        { id, geometry: {type:"Point", coordinates:[lon,lat]},
 *                compass_angle?, captured_at? (epoch ms), thumb_2048_url? }
 *   errors      JSON { error: { message, type: "MLYApiException", code } }
 *
 * Detections: the live API attaches detection OBJECT IDS to /images but does
 * not expose their labels through the fields probed so far. Per spec 31-32
 * and the VPS-06 decision, unknown vendor classes are never assumed:
 * fetchDetections therefore resolves to [] (no detections) instead of
 * guessing, and must be re-verified when official docs for the new API land.
 *
 * This is the only layer that holds the credential and issues Mapillary
 * calls; the browser never sees it (spec 82-83).
 */

const USER_AGENT = "OpenGTA-VPS/1.0 (service-side evidence collection)";
const IMAGE_FIELDS = "compass_angle,captured_at,thumb_2048_url,geometry";

export interface MapillaryClientOptions {
  readonly baseUrl: string;
  /** The Mapillary credential (server-side only). */
  readonly clientId: string;
  readonly fetchImpl?: typeof fetch;
  readonly rateLimiter?: RateLimiter;
  /** Max images per search (the API default is 100; 30 keeps cells light). */
  readonly limit?: number;
}

interface LiveImageItem {
  readonly id?: unknown;
  readonly geometry?: { readonly type?: string; readonly coordinates?: unknown };
  readonly compass_angle?: unknown;
  readonly captured_at?: unknown;
  readonly thumb_2048_url?: unknown;
}

function bboxOf(area: GeoArea, radiusMeters: number): { west: number; south: number; east: number; north: number } {
  const { bounds, center } = area;
  const finite = Number.isFinite(bounds.south) && Number.isFinite(bounds.west) &&
    Number.isFinite(bounds.north) && Number.isFinite(bounds.east);
  if (finite && bounds.north > bounds.south && bounds.east > bounds.west) {
    return { west: bounds.west, south: bounds.south, east: bounds.east, north: bounds.north };
  }
  // Degenerate area: fall back to a radius box around the center.
  const dLat = radiusMeters / 111_320;
  const dLon = radiusMeters / (111_320 * Math.cos((center.latitude * Math.PI) / 180));
  return {
    west: center.longitude - dLon,
    south: center.latitude - dLat,
    east: center.longitude + dLon,
    north: center.latitude + dLat,
  };
}

function toRef(item: LiveImageItem): MapillaryImageRef | undefined {
  if (typeof item.id !== "string" || item.id.length === 0) return undefined;
  const coords = item.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length !== 2) return undefined;
  const longitude = Number(coords[0]);
  const latitude = Number(coords[1]);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return undefined;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return undefined;

  const capturedAtMs = Number(item.captured_at);
  const capturedAt =
    Number.isFinite(capturedAtMs) && capturedAtMs > 0 ? new Date(capturedAtMs).toISOString() : undefined;
  const compassAngle =
    typeof item.compass_angle === "number" && Number.isFinite(item.compass_angle) ? item.compass_angle : undefined;
  const thumbnailUrl =
    typeof item.thumb_2048_url === "string" && item.thumb_2048_url.length > 0 ? item.thumb_2048_url : undefined;

  return { imageId: item.id, latitude, longitude, capturedAt, compassAngle, thumbnailUrl };
}

function typedError(status: number, detail: string): StreetImageryProviderError {
  if (status === 429) return new StreetImageryProviderError("rate-limited", `mapillary rate limit hit: ${detail}`);
  if (status === 401 || status === 403) return new StreetImageryProviderError("auth", `mapillary rejected the credential: ${detail}`);
  return new StreetImageryProviderError("unavailable", `mapillary responded ${status} ${detail}`);
}

export function createMapillaryClient(options: MapillaryClientOptions): MapillaryClient {
  const doFetch = options.fetchImpl ?? fetch;
  const rateLimiter = options.rateLimiter;
  const limit = options.limit ?? 30;
  const base = options.baseUrl.replace(/\/+$/, "");

  return {
    async searchImages(area: GeoArea, radiusMeters: number): Promise<MapillaryImageRef[]> {
      if (rateLimiter) await rateLimiter.acquire();
      const { west, south, east, north } = bboxOf(area, radiusMeters);
      const url = `${base}/images?bbox=${west},${south},${east},${north}&limit=${limit}&fields=${IMAGE_FIELDS}`;

      let response: Response;
      try {
        response = await doFetch(url, {
          method: "GET",
          headers: { authorization: `Bearer ${options.clientId}`, "user-agent": USER_AGENT },
        });
      } catch (err) {
        throw new StreetImageryProviderError("unavailable", `mapillary unreachable: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (!response.ok) {
        let detail = response.statusText;
        try {
          const body = (await response.json()) as { error?: { message?: unknown } };
          if (typeof body.error?.message === "string") detail = body.error.message;
        } catch {
          // non-JSON error body: keep the status text
        }
        throw typedError(response.status, detail);
      }

      let parsed: { data?: unknown };
      try {
        parsed = (await response.json()) as { data?: unknown };
      } catch {
        throw new StreetImageryProviderError("invalid-response", "mapillary returned a non-JSON body");
      }
      if (!Array.isArray(parsed.data)) {
        throw new StreetImageryProviderError("invalid-response", "mapillary response is missing the data array");
      }

      const refs: MapillaryImageRef[] = [];
      for (const item of parsed.data as readonly LiveImageItem[]) {
        const ref = toRef(item);
        if (ref) refs.push(ref);
      }
      return refs;
    },
    async fetchDetections(_imageId: string): Promise<MapillaryDetectionRef[]> {
      // See module doc: labels are not exposed by the live API; degrade to
      // "no detections" rather than inventing classes (spec 31-32).
      return [];
    },
  };
}
