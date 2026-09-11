import { decodeVectorTile, DEFAULT_MAX_TILE_BYTES, type DecodedVectorTile } from "../../../geo/mvt/decode.ts";
import { TileSourceError } from "../../../geo/mvt/errors.ts";
import type { SlippyTile } from "../../../geo/mvt/math.ts";

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

export interface VectorTileProviderOptions { readonly maxTileBytes?: number; readonly timeoutMs?: number }

const DEFAULT_TILE_TIMEOUT_MS = 30_000;

async function readBoundedBytes(response: Response, signal: AbortSignal, maxBytes: number): Promise<Uint8Array> {
  if (!response.body) throw new TileSourceError("invalid-tile", "tile response has no readable body");
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
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
    return merged;
  } finally {
    reader.releaseLock();
    if (signal.aborted) void reader.cancel().catch(() => {});
  }
}

export function createOpenFreeMapProvider(options: VectorTileProviderOptions = {}): VectorTileProvider {
  const maxTileBytes = options.maxTileBytes ?? DEFAULT_MAX_TILE_BYTES;
  if (!Number.isSafeInteger(maxTileBytes) || maxTileBytes <= 0) throw new RangeError("Invalid tile byte budget");
  const timeoutMs = options.timeoutMs ?? DEFAULT_TILE_TIMEOUT_MS;
  // Pinned dataset version: cache identity must never depend on "latest".
  const datasetVersion = "20260830_080001_pt";
  const baseUrl = `https://tiles.openfreemap.org/planet/${datasetVersion}`;
  return {
    id: "openfreemap:planet",
    datasetVersion,
    async getTile(key, signal) {
      if (!Number.isInteger(key.z) || key.z < 0 || key.z > 24 || !Number.isInteger(key.x) || !Number.isInteger(key.y)) throw new TileSourceError("invalid-tile", "invalid tile key");
      if (signal.aborted) throw new TileSourceError("aborted", "tile fetch aborted");
      const url = `${baseUrl}/${key.z}/${key.x}/${key.y}.pbf`;
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
        const retryAfterMs = Number(response.headers.get("retry-after"));
        throw new TileSourceError("http", `tile fetch returned HTTP ${response.status}`, { status: response.status, retryAfterMs: Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? retryAfterMs * 1000 : undefined });
      }
      const bytes = await readBoundedBytes(response, signal, maxTileBytes);
      return decodeVectorTile(bytes);
    },
  };
}
