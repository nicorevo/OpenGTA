import { decodeVectorTile, DEFAULT_MAX_TILE_BYTES, type DecodedVectorTile } from "../../../geo/mvt/decode.ts";
import { TileSourceError } from "../../../geo/mvt/errors.ts";
import type { SlippyTile } from "../../../geo/mvt/math.ts";
import { FetchLimiter } from "./fetch-limiter.ts";
import { TileCache } from "./tile-cache.ts";

/**
 * Provider-neutral vector tile contract: the canonical world only ever sees
 * the decoded model, never provider objects. `null` means a deterministic
 * empty/absent tile, which is a valid geographic result and never an error.
 */
export interface VectorTileProvider {
  readonly id: string;
  readonly datasetVersion: string;
  getTile(key: SlippyTile, signal: AbortSignal): Promise<DecodedVectorTile | null>;
}

export interface VectorTileProviderOptions {
  readonly maxTileBytes?: number;
  readonly timeoutMs?: number;
  /** LRU capacity of decoded tiles (in-flight entries are not evicted). */
  readonly cacheCapacity?: number;
  /** Maximum concurrent tile fetches; excess demands queue in FIFO order. */
  readonly maxConcurrentFetches?: number;
}

const DEFAULT_TILE_TIMEOUT_MS = 30_000;
const DEFAULT_CACHE_CAPACITY = 128;
const DEFAULT_MAX_CONCURRENT_FETCHES = 8;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

async function readBoundedBytes(response: Response, signal: AbortSignal, maxBytes: number): Promise<Uint8Array> {
  if (!response.body) throw new TileSourceError("invalid-tile", "tile response has no readable body");
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  let complete = false;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) throw new TileSourceError("response-too-large", "tile exceeds byte budget", { status: response.status });
      parts.push(part.value);
    }
    const merged = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) { merged.set(part, offset); offset += part.byteLength; }
    complete = true;
    return merged;
  } finally {
    if (!complete) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new TileSourceError("aborted", "tile fetch aborted"));
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => { clearTimeout(timer); reject(new TileSourceError("aborted", "tile fetch aborted")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function parseRetryAfterMs(header: string | null): number | undefined {
  if (header === null) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
}

async function fetchDecodedTile(url: string, signal: AbortSignal, timeoutMs: number, maxTileBytes: number): Promise<DecodedVectorTile | null> {
  const fetchOnce = async (): Promise<DecodedVectorTile | null> => {
    const timed = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
    let response: Response;
    try {
      response = await fetch(url, { signal: timed });
    } catch (error) {
      if (signal.aborted) throw new TileSourceError("aborted", "tile fetch aborted");
      if (error instanceof Error && error.name === "TimeoutError") throw new TileSourceError("timeout", "tile fetch timed out", { cause: error });
      throw new TileSourceError("network", "tile fetch failed", { cause: error });
    }
    if (response.status === 404 || response.status === 204) return null;
    if (!response.ok) {
      throw new TileSourceError("http", `tile fetch returned HTTP ${response.status}`, { status: response.status, retryAfterMs: parseRetryAfterMs(response.headers.get("retry-after")) });
    }
    const bytes = await readBoundedBytes(response, signal, maxTileBytes);
    return decodeVectorTile(bytes);
  };
  try {
    return await fetchOnce();
  } catch (error) {
    // One bounded retry for rate-limit/gateway statuses: honor Retry-After
    // (clamped), stay abort-aware, then give up instead of hammering the
    // public endpoint. Network/timeout/other statuses fail fast.
    if (!(error instanceof TileSourceError) || error.code !== "http" || !RETRYABLE_STATUSES.has(error.status ?? 0)) throw error;
    const delayMs = Math.min(error.retryAfterMs ?? DEFAULT_RETRY_DELAY_MS, MAX_RETRY_DELAY_MS);
    await abortableDelay(delayMs, signal);
    return fetchOnce();
  }
}

// Pinned dataset version: cache identity must never depend on "latest".
export const OPENFREEMAP_DATASET_VERSION = "20260830_080001_pt";
export const OPENFREEMAP_TILE_BASE_URL = `https://tiles.openfreemap.org/planet/${OPENFREEMAP_DATASET_VERSION}`;

export function createOpenFreeMapProvider(options: VectorTileProviderOptions = {}): VectorTileProvider {
  const maxTileBytes = options.maxTileBytes ?? DEFAULT_MAX_TILE_BYTES;
  if (!Number.isSafeInteger(maxTileBytes) || maxTileBytes <= 0) throw new RangeError("Invalid tile byte budget");
  const timeoutMs = options.timeoutMs ?? DEFAULT_TILE_TIMEOUT_MS;
  const datasetVersion = OPENFREEMAP_DATASET_VERSION;
  const baseUrl = OPENFREEMAP_TILE_BASE_URL;
  const tileCache = new TileCache<DecodedVectorTile | null>(options.cacheCapacity ?? DEFAULT_CACHE_CAPACITY);
  const limiter = new FetchLimiter(options.maxConcurrentFetches ?? DEFAULT_MAX_CONCURRENT_FETCHES);
  return {
    id: "openfreemap:planet",
    datasetVersion,
    async getTile(key, signal) {
      if (!Number.isInteger(key.z) || key.z < 0 || key.z > 24 || !Number.isInteger(key.x) || !Number.isInteger(key.y)) throw new TileSourceError("invalid-tile", "invalid tile key");
      if (signal.aborted) throw new TileSourceError("aborted", "tile fetch aborted");
      const url = `${baseUrl}/${key.z}/${key.x}/${key.y}.pbf`;
      // Chunk compiles share tiles across chunks and sessions of the provider:
      // the cache dedups in-flight fetches and serves decoded values, the
      // limiter bounds the public endpoint concurrency.
      return tileCache.get(`${key.z}/${key.x}/${key.y}`, signal, () => limiter.run(() => fetchDecodedTile(url, signal, timeoutMs, maxTileBytes), signal));
    },
  };
}
