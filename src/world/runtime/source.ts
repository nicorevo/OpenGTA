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
  readonly headers?: { get(name: string): string | null };
  json(): Promise<unknown>;
}

export type GeoDataFetcher = (url: string, signal: AbortSignal, body?: string) => Promise<GeoDataResponse>;

export interface OverpassOptions {
  readonly maxRetries?: number;
  readonly retryDelayMs?: number;
}

export type GeoDataErrorCode = "invalid-request" | "http" | "network" | "provider-error" | "invalid-response" | "timeout" | "aborted" | "queue-full" | "queue-timeout";

export class GeoDataSourceError extends Error {
  readonly code: GeoDataErrorCode;
  readonly status?: number;

  constructor(code: GeoDataErrorCode, message: string, status?: number, cause?: unknown) {
    super(message, { cause });
    this.name = "GeoDataSourceError";
    this.code = code;
    this.status = status;
  }
}

const MAX_RADIUS_METERS = 100_000;
const MAX_REGION_ID_LENGTH = 128;
const MAX_ELEMENTS = 100_000;

function validateRequest(request: RuntimeRegionRequest): void {
  if (!request || typeof request.regionId !== "string" || request.regionId.length === 0 || request.regionId.length > MAX_REGION_ID_LENGTH) {
    throw new TypeError("runtime region id must be a non-empty bounded string");
  }
  if (!request.origin || !Number.isFinite(request.origin.latitude) || request.origin.latitude < -90 || request.origin.latitude > 90) {
    throw new RangeError("runtime latitude must be finite and between -90 and 90");
  }
  if (!Number.isFinite(request.origin.longitude) || request.origin.longitude < -180 || request.origin.longitude > 180) {
    throw new RangeError("runtime longitude must be finite and between -180 and 180");
  }
  if (!Number.isFinite(request.radiusMeters) || request.radiusMeters <= 0 || request.radiusMeters > MAX_RADIUS_METERS) {
    throw new RangeError("runtime radius must be positive and bounded");
  }
}

function validateResponse(value: unknown, status?: number): RawOsm {
  if (!value || typeof value !== "object" || !Array.isArray((value as { elements?: unknown }).elements)) {
    throw new GeoDataSourceError("invalid-response", "OSM response must contain an elements array", status);
  }
  const elements = (value as { elements: unknown[] }).elements;
  if (elements.length > MAX_ELEMENTS || elements.some((element) => !element || typeof element !== "object" || !["node", "way", "relation"].includes((element as { type?: unknown }).type as string))) {
    throw new GeoDataSourceError("invalid-response", "OSM response contains invalid or excessive elements", status);
  }
  return { elements } as RawOsm;
}

async function readResponse(response: GeoDataResponse, overpass = false): Promise<RawOsm> {
  let payload: unknown;
  try { payload = await response.json(); }
  catch (cause) { throw new GeoDataSourceError("invalid-response", "OSM response is not valid JSON", response.status, cause); }
  if (overpass && payload && typeof payload === "object" && "remark" in payload) {
    if (typeof payload.remark !== "string") throw new GeoDataSourceError("invalid-response", "OSM response has an invalid remark", response.status);
    if (payload.remark.length > 0) throw new GeoDataSourceError("provider-error", "OSM provider reported an incomplete response", response.status);
  }
  return validateResponse(payload, response.status);
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
      try { validateRequest(request); }
      catch (cause) { throw new GeoDataSourceError("invalid-request", cause instanceof Error ? cause.message : "Invalid region request", undefined, cause); }
      const startedAt = now();
      if (!Number.isFinite(startedAt)) throw new RangeError("source clock must be finite");
      if (startedAt - lastStartedAt < minIntervalMs) throw new Error("source rate limit interval has not elapsed");
      lastStartedAt = startedAt;
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new GeoDataSourceError("timeout", "geo data source request timed out"));
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
    let response: GeoDataResponse;
    try { response = await fetcher(url.toString(), signal); }
    catch (cause) { throw new GeoDataSourceError("network", "geo data source fetch failed", undefined, cause); }
    if (!response.ok) throw new GeoDataSourceError("http", `geo data source returned HTTP ${response.status}`, response.status);
    return readResponse(response);
  }, { timeoutMs: 30_000, minIntervalMs: 1_000 });
}

export const DEFAULT_OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

export function createOverpassGeoDataSource(endpoint = DEFAULT_OVERPASS_ENDPOINT, fetcher: GeoDataFetcher = async (url, signal, body) => fetch(url, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body,
  signal,
}), options: OverpassOptions = {}): GeoDataSource {
  const maxRetries = options.maxRetries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 1_500;
  if (!Number.isInteger(maxRetries) || maxRetries < 0) throw new RangeError("Overpass retries must be a non-negative integer");
  if (!Number.isFinite(retryDelayMs) || retryDelayMs < 0) throw new RangeError("Overpass retry delay must be non-negative");
  return createGeoDataSource(async (request, signal) => {
    const latitudeDelta = request.radiusMeters / 111_320;
    const longitudeDelta = request.radiusMeters / (111_320 * Math.max(0.01, Math.cos(request.origin.latitude * Math.PI / 180)));
    const south = request.origin.latitude - latitudeDelta;
    const west = request.origin.longitude - longitudeDelta;
    const north = request.origin.latitude + latitudeDelta;
    const east = request.origin.longitude + longitudeDelta;
    const bbox = `${south},${west},${north},${east}`;
    const query = `[out:json][timeout:25];(nwr["building"](${bbox});nwr["highway"](${bbox});nwr["landuse"](${bbox});nwr["natural"](${bbox});nwr["waterway"](${bbox});nwr["barrier"](${bbox}););out body;>;out skel qt;`;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      let response: GeoDataResponse | undefined;
      let networkError: unknown;
      try {
        response = await fetcher(endpoint, signal, `data=${encodeURIComponent(query)}`);
      } catch (error: unknown) {
        networkError = error;
      }
      if (response?.ok) {
        return readResponse(response, true);
      }
      const retryable = networkError !== undefined || response?.status === 429 || response?.status === 503 || (response?.status ?? 0) >= 500;
      if (!retryable || attempt === maxRetries) {
        if (networkError !== undefined) throw new GeoDataSourceError("network", "geo data source fetch failed", undefined, networkError);
        throw new GeoDataSourceError("http", `geo data source returned HTTP ${response?.status}`, response?.status);
      }
      const retryAfter = Number(response?.headers?.get("retry-after"));
      const delay = Number.isFinite(retryAfter) && retryAfter >= 0 ? retryAfter * 1_000 : retryDelayMs * (attempt + 1);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delay);
        signal.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
      });
    }
    throw new GeoDataSourceError("network", "geo data source retry loop exhausted");
  }, { timeoutMs: 30_000, minIntervalMs: 2_000 });
}

export async function compileRuntimeRegion(source: GeoDataSource, request: RuntimeRegionRequest): Promise<CompileResult> {
  const raw = await source.acquire(request);
  const region = normalizeOsm(raw, createTangentProjector(request.origin), request.origin, request.regionId);
  return compileRegion(region);
}
