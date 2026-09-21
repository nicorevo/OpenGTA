import { readBoundedJson } from "../world/runtime/response-reader.ts";
import { GeoDataSourceError } from "../world/runtime/source-error.ts";

/** Pinned, trusted geocoding endpoints (never taken from user input). */
export const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
export const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const MAX_NAME_LENGTH = 256;

export interface GeocodeCandidate {
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly placeId: string;
}

export type GeocodeErrorCode = "network" | "http" | "rate-limited" | "timeout" | "invalid-response" | "aborted";

export class GeocodeError extends Error {
  readonly code: GeocodeErrorCode;
  readonly status?: number;

  constructor(code: GeocodeErrorCode, message: string, status?: number, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "GeocodeError";
    this.code = code;
    this.status = status;
  }
}

export type GeocodeFetcher = (url: string, init: { signal: AbortSignal }) => Promise<Response>;

export interface GeocodeClientOptions {
  /** Defaults to the pinned Nominatim search URL; injectable for tests. */
  readonly endpoint?: string;
  /** Defaults to the pinned Nominatim reverse URL; injectable for tests. */
  readonly reverseEndpoint?: string;
  readonly fetcher?: GeocodeFetcher;
  readonly timeoutMs?: number;
  readonly maxCandidates?: number;
  readonly maxResponseBytes?: number;
  readonly maxCacheEntries?: number;
}

export interface GeocodeClient {
  search(query: string, signal?: AbortSignal): Promise<GeocodeCandidate[]>;
  /** Resolves undefined when Nominatim has no data for the point. */
  reverse(latitude: number, longitude: number, signal?: AbortSignal): Promise<GeocodeCandidate | undefined>;
}

/** Trim, collapse whitespace and casefold a query (cache key + blank check). */
export function normalizeGeocodeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

function parseCoordinate(value: unknown, bound: number): number | undefined {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) && Math.abs(number) <= bound ? number : undefined;
}

function parseCandidate(raw: unknown): GeocodeCandidate | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const entry = raw as Record<string, unknown>;
  const latitude = parseCoordinate(entry.lat, 90);
  const longitude = parseCoordinate(entry.lon, 180);
  const name = typeof entry.display_name === "string" ? entry.display_name.trim() : "";
  if (latitude === undefined || longitude === undefined || name.length === 0 || name.length > MAX_NAME_LENGTH) return undefined;
  const placeId = typeof entry.place_id === "string" ? entry.place_id : typeof entry.place_id === "number" ? String(entry.place_id) : "";
  return { name, latitude, longitude, placeId };
}

/**
 * Pure geocoding client over Nominatim (OSM). No DOM access; the fetcher,
 * timeout and byte budget are injectable so the module stays unit-testable.
 * Only successful lookups are cached (bounded LRU, in-memory only).
 */
export function createGeocodeClient(options: GeocodeClientOptions = {}): GeocodeClient {
  const endpoint = options.endpoint ?? NOMINATIM_SEARCH_URL;
  const reverseEndpoint = options.reverseEndpoint ?? NOMINATIM_REVERSE_URL;
  const fetcher: GeocodeFetcher = options.fetcher ?? ((url, init) => fetch(url, { ...init, headers: { accept: "application/json" } }));
  const timeoutMs = options.timeoutMs ?? 5_000;
  const maxCandidates = options.maxCandidates ?? 5;
  const maxResponseBytes = options.maxResponseBytes ?? 256 * 1024;
  const maxCacheEntries = options.maxCacheEntries ?? 32;
  const cache = new Map<string, GeocodeCandidate[]>();

  function remember(key: string, value: GeocodeCandidate[]): void {
    cache.delete(key);
    cache.set(key, value);
    while (cache.size > maxCacheEntries) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }

  function toGeocodeError(cause: unknown, timedOut: boolean, callerSignal?: AbortSignal): GeocodeError {
    if (timedOut) return new GeocodeError("timeout", "geocode search timed out", undefined, { cause });
    if (callerSignal?.aborted) return new GeocodeError("aborted", "geocode search aborted");
    if (cause instanceof GeoDataSourceError) {
      if (cause.code === "aborted") return new GeocodeError("aborted", "geocode response read aborted", cause.status);
      return new GeocodeError("invalid-response", cause.message, cause.status, { cause });
    }
    return new GeocodeError("network", "geocode search failed", undefined, { cause });
  }

  async function fetchJson(url: string, callerSignal: AbortSignal | undefined): Promise<unknown> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    const forwardAbort = () => controller.abort();
    callerSignal?.addEventListener("abort", forwardAbort, { once: true });
    try {
      if (callerSignal?.aborted || controller.signal.aborted) throw new GeocodeError("aborted", "geocode request aborted");
      const response = await fetcher(url.toString(), { signal: controller.signal });
      if (!response.ok) {
        if (response.status === 429) throw new GeocodeError("rate-limited", "geocode request rate limited", response.status);
        throw new GeocodeError("http", "geocode request failed", response.status);
      }
      return await readBoundedJson(response, controller.signal, maxResponseBytes);
    } catch (cause) {
      if (cause instanceof GeocodeError) throw cause;
      throw toGeocodeError(cause, timedOut, callerSignal);
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener("abort", forwardAbort);
    }
  }

  return {
    async search(query, callerSignal) {
      const key = normalizeGeocodeQuery(query);
      if (key.length === 0) return [];
      const cached = cache.get(key);
      if (cached) {
        cache.delete(key);
        cache.set(key, cached);
        return [...cached];
      }
      const url = new URL(endpoint);
      url.searchParams.set("q", query.trim());
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", String(maxCandidates));
      url.searchParams.set("accept-language", "it");
      const value = await fetchJson(url.toString(), callerSignal);
      if (!Array.isArray(value)) throw new GeocodeError("invalid-response", "geocode response is not a candidate list");
      const candidates = value
        .map(parseCandidate)
        .filter((candidate): candidate is GeocodeCandidate => candidate !== undefined)
        .slice(0, maxCandidates);
      remember(key, candidates);
      return [...candidates];
    },
    async reverse(latitude, longitude, callerSignal) {
      if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
        throw new GeocodeError("invalid-response", "reverse coordinates are out of bounds");
      }
      const url = new URL(reverseEndpoint);
      url.searchParams.set("lat", String(latitude));
      url.searchParams.set("lon", String(longitude));
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("zoom", "10");
      url.searchParams.set("accept-language", "it");
      const value = await fetchJson(url.toString(), callerSignal);
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new GeocodeError("invalid-response", "geocode reverse response is not an object");
      }
      const entry = value as Record<string, unknown>;
      if (typeof entry.error === "string") return undefined;
      const name = typeof entry.display_name === "string" ? entry.display_name.trim() : "";
      if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
        throw new GeocodeError("invalid-response", "geocode reverse response has no usable name");
      }
      const placeId = typeof entry.place_id === "string" ? entry.place_id : typeof entry.place_id === "number" ? String(entry.place_id) : "";
      return { name, latitude, longitude, placeId };
    },
  };
}
