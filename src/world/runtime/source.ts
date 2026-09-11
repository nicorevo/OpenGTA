import { createTangentProjector } from "../../geo/coordinates/projector.ts";
import { normalizeOsm, type RawOsm } from "../../geo/normalize/osm.ts";
import { compileRegion, type CompileResult } from "../compiler/compiled.ts";
import { createRequestScheduler, type AcquireOptions, type SchedulerOptions, type AttemptContext } from "./request-scheduler.ts";
import { GeoDataSourceError } from "./source-error.ts";
import { readBoundedJson, DEFAULT_RESPONSE_BYTES } from "./response-reader.ts";
export { GeoDataSourceError, type GeoDataErrorCode } from "./source-error.ts";
export type { AcquireOptions } from "./request-scheduler.ts";

export interface RuntimeRegionRequest {
  readonly regionId: string;
  readonly origin: { readonly latitude: number; readonly longitude: number };
  readonly radiusMeters: number;
}

export interface CompilePhaseTimings { decodeMs?: number }
export type GeoDataLoader = (request: RuntimeRegionRequest, signal: AbortSignal, context: AttemptContext, phases?: CompilePhaseTimings) => Promise<unknown>;

export interface GeoDataSource {
  acquire(request: RuntimeRegionRequest, options?: AcquireOptions): Promise<RawOsm>;
  promote?(signal: AbortSignal, priority: 0 | 1 | 2): void;
}

export interface GeoDataSourceOptions extends SchedulerOptions {}

export interface GeoDataResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly headers?: { get(name: string): string | null };
  readonly body?: ReadableStream<Uint8Array> | null;
  json(): Promise<unknown>;
}

export type GeoDataFetcher = (url: string, signal: AbortSignal, body?: string) => Promise<GeoDataResponse>;

export interface HttpSourceOptions extends GeoDataSourceOptions { readonly maxResponseBytes?: number }
export interface OverpassOptions extends HttpSourceOptions {
  readonly maxRetries?: number;
  readonly retryDelayMs?: number;
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

async function readResponse(response: GeoDataResponse, signal: AbortSignal, maxBytes: number, overpass = false): Promise<RawOsm> {
  let payload: unknown;
  try {
    // Native Fetch responses always have body, including null. json-only fakes
    // remain injectable for tests; production never falls back from a missing stream.
    payload = "body" in response ? await readBoundedJson({ body: response.body ?? null, status: response.status }, signal, maxBytes) : await response.json();
  }
  catch (cause) { if (cause instanceof GeoDataSourceError) throw cause; throw new GeoDataSourceError("invalid-response", "OSM response is not valid JSON", response.status, cause); }
  if (overpass && payload && typeof payload === "object" && "remark" in payload) {
    if (typeof payload.remark !== "string") throw new GeoDataSourceError("invalid-response", "OSM response has an invalid remark", response.status);
    if (payload.remark.length > 0) throw new GeoDataSourceError("provider-error", "OSM provider reported an incomplete response", response.status);
  }
  return validateResponse(payload, response.status);
}

export function createGeoDataSource(loader: GeoDataLoader, options: GeoDataSourceOptions = {}): GeoDataSource {
  const scheduler = createRequestScheduler(options);
  return {
    promote: scheduler.promote,
    async acquire(request, input) {
      try { validateRequest(request); }
      catch (cause) { throw new GeoDataSourceError("invalid-request", cause instanceof Error ? cause.message : "Invalid region request", undefined, cause); }
      return scheduler.run(async (context) => validateResponse(await loader({ ...request, origin: { ...request.origin } }, context.signal, context, input?.phases)), input);
    },
  };
}

export function createHttpGeoDataSource(endpoint: string, fetcher: GeoDataFetcher = async (url, signal) => fetch(url, { signal }), options: HttpSourceOptions = {}): GeoDataSource {
  const baseUrl = new URL(endpoint);
  const maxBytes = options.maxResponseBytes ?? DEFAULT_RESPONSE_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new RangeError("Invalid response byte budget");
  return createGeoDataSource(async (request, signal, _context, phases) => {
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
    const decodeStarted = performance.now();
    const raw = await readResponse(response, signal, maxBytes);
    if (phases) phases.decodeMs = performance.now() - decodeStarted;
    return raw;
  }, { timeoutMs: 30_000, minIntervalMs: 1_000, ...options });
}

export const OSM_QUERY_PROFILE = "osm-v1-park-parking";
export const DEFAULT_OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

export function retryAfterMilliseconds(value: string | null | undefined, now: number): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  if (/^\d+(\.\d+)?$/.test(value.trim())) { const milliseconds = Number(value) * 1000; return Number.isFinite(milliseconds) ? milliseconds : undefined; }
  if (!/[A-Za-z]/.test(value)) return undefined;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : undefined;
}

export function createOverpassGeoDataSource(endpoint = DEFAULT_OVERPASS_ENDPOINT, fetcher: GeoDataFetcher = async (url, signal, body) => fetch(url, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body,
  signal,
}), options: OverpassOptions = {}): GeoDataSource {
  const maxRetries = options.maxRetries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 1_500;
  const maxBytes = options.maxResponseBytes ?? DEFAULT_RESPONSE_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new RangeError("Invalid response byte budget");
  if (!Number.isInteger(maxRetries) || maxRetries < 0) throw new RangeError("Overpass retries must be a non-negative integer");
  if (!Number.isFinite(retryDelayMs) || retryDelayMs < 0) throw new RangeError("Overpass retry delay must be non-negative");
  const now = options.now ?? Date.now;
  return createGeoDataSource(async (request, signal, context, phases) => {
    const latitudeDelta = request.radiusMeters / 111_320;
    const longitudeDelta = request.radiusMeters / (111_320 * Math.max(0.01, Math.cos(request.origin.latitude * Math.PI / 180)));
    const south = request.origin.latitude - latitudeDelta;
    const west = request.origin.longitude - longitudeDelta;
    const north = request.origin.latitude + latitudeDelta;
    const east = request.origin.longitude + longitudeDelta;
    const bbox = `${south},${west},${north},${east}`;
    const query = `[out:json][timeout:25];(nwr["building"](${bbox});nwr["highway"](${bbox});nwr["landuse"](${bbox});nwr["natural"](${bbox});nwr["waterway"](${bbox});nwr["barrier"](${bbox});nwr["leisure"="park"](${bbox});nwr["amenity"="parking"](${bbox}););out body;>;out skel qt;`;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      signal.throwIfAborted();
      if (attempt > 0) await context.attempt();
      let response: GeoDataResponse | undefined;
      let networkError: unknown;
      try {
        response = await fetcher(endpoint, signal, `data=${encodeURIComponent(query)}`);
      } catch (error: unknown) {
        networkError = error;
      }
      signal.throwIfAborted();
      if (response?.ok) {
        const decodeStarted = performance.now();
        const raw = await readResponse(response, signal, maxBytes, true);
        if (phases) phases.decodeMs = performance.now() - decodeStarted;
        return raw;
      }
      const retryable = networkError !== undefined || response?.status === 429 || response?.status === 503 || (response?.status ?? 0) >= 500;
      const delay = retryAfterMilliseconds(response?.headers?.get("retry-after"), now()) ?? retryDelayMs * (attempt + 1);
      const retryAt = now() + delay;
      if (retryable) context.deferUntil(retryAt);
      if (!retryable || attempt === maxRetries) {
        if (networkError !== undefined) throw new GeoDataSourceError("network", "geo data source fetch failed", undefined, networkError);
        throw new GeoDataSourceError("http", `geo data source returned HTTP ${response?.status}`, response?.status, undefined, retryable ? retryAt : undefined);
      }
      if (retryAt >= context.deadline) throw new GeoDataSourceError(response ? "http" : "network", "Provider cooldown exceeds request budget", response?.status, networkError, retryAt);
    }
    throw new GeoDataSourceError("network", "geo data source retry loop exhausted");
  }, { timeoutMs: 30_000, minIntervalMs: 2_000, ...options });
}

export async function compileRuntimeRegion(source: GeoDataSource, request: RuntimeRegionRequest, options?: AcquireOptions): Promise<CompileResult> {
  const phases: CompilePhaseTimings = {};
  const acquireStarted = performance.now();
  const raw = await source.acquire(request, { ...options, phases });
  const acquireMs = performance.now() - acquireStarted;
  options?.signal?.throwIfAborted();
  const normalizeStarted = performance.now();
  const region = normalizeOsm(raw, createTangentProjector(request.origin), request.origin, request.regionId, { signal: options?.signal });
  const normalizeMs = performance.now() - normalizeStarted;
  const result = compileRegion(region, { signal: options?.signal });
  const compileMs = result.diagnostics.stageDurationsMs.compile ?? 0;
  const stageDurationsMs = { acquire: acquireMs, decode: phases.decodeMs ?? 0, normalize: normalizeMs, compile: compileMs, total: acquireMs + normalizeMs + compileMs };
  return { chunks: result.chunks.map((chunk) => ({ ...chunk, diagnostics: { ...chunk.diagnostics, stageDurationsMs } })), diagnostics: { ...result.diagnostics, stageDurationsMs } };
}
