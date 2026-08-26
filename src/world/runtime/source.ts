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

export async function compileRuntimeRegion(source: GeoDataSource, request: RuntimeRegionRequest): Promise<CompileResult> {
  const raw = await source.acquire(request);
  const region = normalizeOsm(raw, createTangentProjector(request.origin), request.origin, request.regionId);
  return compileRegion(region);
}
