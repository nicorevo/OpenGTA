import { createTangentProjector } from "../../geo/coordinates/projector.ts";
import { tilesForBounds } from "../../geo/mvt/coverage.ts";
import { MVT_TILE_ZOOM, normalizeMvtTiles } from "../../geo/normalize/mvt.ts";
import { normalizeOsm } from "../../geo/normalize/osm.ts";
import type { WorldRegion } from "../model/types.ts";
import type { CompilePhaseTimings, GeoDataSource, RuntimeRegionRequest, SourceDiagnostics } from "./source.ts";
import type { VectorTileProvider } from "./vector-tile/provider.ts";

/**
 * Provider-neutral contract: a canonical source turns a runtime region
 * request into a WorldRegion. The runtime compiles it through the single
 * canonical compiler; sources never see chunks, caches or renderers.
 */
export interface CanonicalRegionSource {
  /** Stable cache-namespace identity (provider + dataset). */
  readonly identity: string;
  /** Normalizer/query profile version; part of the cache namespace. */
  readonly profile: string;
  acquire(request: RuntimeRegionRequest, options?: { signal?: AbortSignal; phases?: CompilePhaseTimings }): Promise<WorldRegion>;
  promote?(signal: AbortSignal, priority: 0 | 1 | 2): void;
  diagnostics?(): SourceDiagnostics | undefined;
}

export interface OverpassCanonicalSourceOptions {
  readonly source: GeoDataSource;
  readonly identity: string;
  readonly profile?: string;
}

/** Wraps an Overpass/http GeoDataSource behind the canonical contract. */
export function createOverpassCanonicalRegionSource(options: OverpassCanonicalSourceOptions): CanonicalRegionSource {
  return {
    identity: options.identity,
    profile: options.profile ?? "osm-v1",
    async acquire(request, input) {
      const raw = await options.source.acquire(request, input);
      return normalizeOsm(raw, createTangentProjector(request.origin), request.origin, request.regionId, { signal: input?.signal });
    },
    promote: (signal, priority) => options.source.promote?.(signal, priority),
    diagnostics: () => options.source.diagnostics?.(),
  };
}

export interface VectorTileCanonicalSourceOptions {
  readonly provider: VectorTileProvider;
  readonly identity: string;
}

/** Resolves z14 tiles for the request and normalizes them through the canonical MVT normalizer. */
export function createVectorTileCanonicalRegionSource(options: VectorTileCanonicalSourceOptions): CanonicalRegionSource {
  return {
    identity: options.identity,
    profile: "mvt-z14-v1",
    async acquire(request, input) {
      const signal = input?.signal ?? new AbortController().signal;
      const latitudeDelta = request.radiusMeters / 111_320;
      const longitudeDelta = request.radiusMeters / (111_320 * Math.max(0.01, Math.cos(request.origin.latitude * Math.PI / 180)));
      const tiles = tilesForBounds({
        minLatitude: request.origin.latitude - latitudeDelta,
        minLongitude: request.origin.longitude - longitudeDelta,
        maxLatitude: request.origin.latitude + latitudeDelta,
        maxLongitude: request.origin.longitude + longitudeDelta,
      }, MVT_TILE_ZOOM);
      const decodedTiles = [];
      for (const tile of tiles) {
        const decoded = await options.provider.getTile(tile, signal);
        if (decoded) decodedTiles.push({ tile, decoded });
      }
      return normalizeMvtTiles({ tiles: decodedTiles, origin: request.origin, regionId: request.regionId }).region;
    },
  };
}
