import { createTangentProjector } from "../../geo/coordinates/projector.ts";
import { normalizeOsm, type RawOsm } from "../../geo/normalize/osm.ts";
import { compileRegion, type CompileResult } from "../compiler/compiled.ts";

export interface RuntimeRegionRequest {
  readonly regionId: string;
  readonly origin: { readonly latitude: number; readonly longitude: number };
  readonly radiusMeters: number;
}

export type GeoDataLoader = (request: RuntimeRegionRequest, signal: AbortSignal) => Promise<unknown>;

export interface GeoDataSource {
  acquire(request: RuntimeRegionRequest): Promise<RawOsm>;
}

export interface GeoDataSourceOptions {
  readonly timeoutMs?: number;
  readonly minIntervalMs?: number;
  readonly now?: () => number;
}

export interface GeoDataResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type GeoDataFetcher = (url: string, signal: AbortSignal, body?: string) => Promise<GeoDataResponse>;

const MAX_RADIUS_METERS = 100_000;
const MAX_REGION_ID_LENGTH = 128;
const MAX_ELEMENTS = 100_000;

function validateRequest(request: RuntimeRegionRequest): void {
  if (!request || typeof request.regionId !== "string" || request.regionId.length === 0 || request.regionId.length > MAX_REGION_ID_LENGTH) {
    throw new TypeError("runtime region id must be a non-empty bounded string");
  }
  if (!Number.isFinite(request.origin.latitude) || request.origin.latitude < -90 || request.origin.latitude > 90) {
    throw new RangeError("runtime latitude must be finite and between -90 and 90");
  }
  if (!Number.isFinite(request.origin.longitude) || request.origin.longitude < -180 || request.origin.longitude > 180) {
    throw new RangeError("runtime longitude must be finite and between -180 and 180");
  }
  if (!Number.isFinite(request.radiusMeters) || request.radiusMeters <= 0 || request.radiusMeters > MAX_RADIUS_METERS) {
    throw new RangeError("runtime radius must be positive and bounded");
  }
}

function validateResponse(value: unknown): RawOsm {
  if (!value || typeof value !== "object" || !Array.isArray((value as { elements?: unknown }).elements)) {
    throw new TypeError("OSM response must contain an elements array");
  }
  const elements = (value as { elements: unknown[] }).elements;
  if (elements.length > MAX_ELEMENTS || elements.some((element) => !element || typeof element !== "object" || !["node", "way", "relation"].includes((element as { type?: unknown }).type as string))) {
    throw new TypeError("OSM response contains invalid or excessive elements");
  }
  return { elements } as RawOsm;
}

export function createGeoDataSource(loader: GeoDataLoader, options: GeoDataSourceOptions = {}): GeoDataSource {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const minIntervalMs = options.minIntervalMs ?? 0;
  const now = options.now ?? Date.now;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError("source timeout must be positive");
  if (!Number.isFinite(minIntervalMs) || minIntervalMs < 0) throw new RangeError("source interval must be non-negative");
  let lastStartedAt = Number.NEGATIVE_INFINITY;

  return {
    async acquire(request) {
      validateRequest(request);
      const startedAt = now();
      if (!Number.isFinite(startedAt)) throw new RangeError("source clock must be finite");
      if (startedAt - lastStartedAt < minIntervalMs) throw new Error("source rate limit interval has not elapsed");
      lastStartedAt = startedAt;
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("geo data source request timed out"));
        }, timeoutMs);
      });
      try {
        const response = await Promise.race([loader({ ...request, origin: { ...request.origin } }, controller.signal), timeout]);
        return validateResponse(response);
      } finally {
        if (timer !== undefined) clearTimeout(timer);
        controller.abort();
      }
    },
  };
}

export function createHttpGeoDataSource(endpoint: string, fetcher: GeoDataFetcher = async (url, signal) => fetch(url, { signal })): GeoDataSource {
  const baseUrl = new URL(endpoint);
  return createGeoDataSource(async (request, signal) => {
    const latitudeDelta = request.radiusMeters / 111_320;
    const longitudeDelta = request.radiusMeters / (111_320 * Math.max(0.01, Math.cos(request.origin.latitude * Math.PI / 180)));
    const url = new URL(baseUrl);
    url.searchParams.set("bbox", [
      request.origin.latitude - latitudeDelta,
      request.origin.longitude - longitudeDelta,
      request.origin.latitude + latitudeDelta,
      request.origin.longitude + longitudeDelta,
    ].join(","));
    const response = await fetcher(url.toString(), signal);
    if (!response.ok) throw new Error(`geo data source returned HTTP ${response.status}`);
    return response.json();
  }, { timeoutMs: 30_000, minIntervalMs: 1_000 });
}

export const DEFAULT_OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

export function createOverpassGeoDataSource(endpoint = DEFAULT_OVERPASS_ENDPOINT, fetcher: GeoDataFetcher = async (url, signal, body) => fetch(url, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body,
  signal,
})): GeoDataSource {
  return createGeoDataSource(async (request, signal) => {
    const latitudeDelta = request.radiusMeters / 111_320;
    const longitudeDelta = request.radiusMeters / (111_320 * Math.max(0.01, Math.cos(request.origin.latitude * Math.PI / 180)));
    const south = request.origin.latitude - latitudeDelta;
    const west = request.origin.longitude - longitudeDelta;
    const north = request.origin.latitude + latitudeDelta;
    const east = request.origin.longitude + longitudeDelta;
    const bbox = `${south},${west},${north},${east}`;
    const query = `[out:json][timeout:25];(nwr["building"](${bbox});nwr["highway"](${bbox});nwr["landuse"](${bbox});nwr["natural"](${bbox});nwr["waterway"](${bbox});nwr["barrier"](${bbox}););out body;>;out skel qt;`;
    const response = await fetcher(endpoint, signal, `data=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`geo data source returned HTTP ${response.status}`);
    return response.json();
  });
}

export async function compileRuntimeRegion(source: GeoDataSource, request: RuntimeRegionRequest): Promise<CompileResult> {
  const raw = await source.acquire(request);
  const region = normalizeOsm(raw, createTangentProjector(request.origin), request.origin, request.regionId);
  return compileRegion(region);
}
