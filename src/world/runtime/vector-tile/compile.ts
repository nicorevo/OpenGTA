import { createTangentProjector } from "../../../geo/coordinates/projector.ts";
import { tilesForBounds } from "../../../geo/mvt/coverage.ts";
import { MVT_TILE_ZOOM, normalizeMvtTiles } from "../../../geo/normalize/mvt.ts";
import { compileRegion, type CompiledChunkV0 } from "../../compiler/compiled.ts";
import { partitionCompiledChunk, translateCompiledChunk } from "../../compiler/partition.ts";
import type { ChunkGrid, ChunkKey } from "../../chunk/grid.ts";
import type { ChunkLoadContext } from "../../chunk/lifecycle.ts";
import type { RuntimeRegionRequest } from "../source.ts";
import type { VectorTileProvider } from "./provider.ts";

export interface MvtChunkCompilerOptions {
  readonly provider: VectorTileProvider;
  readonly grid: ChunkGrid;
  readonly origin: { readonly latitude: number; readonly longitude: number };
}

export type MvtChunkCompiler = (key: ChunkKey, request: RuntimeRegionRequest, context: ChunkLoadContext) => Promise<CompiledChunkV0>;

/**
 * Open-world compile seam (options.compile) for the OpenFreeMap provider:
 * per chunk, resolves the intersecting z14 tiles, decodes them, normalizes
 * to a WorldRegion around the chunk center and compiles through the SINGLE
 * canonical compiler, then aligns the chunk to the grid cell. The runtime
 * source is a placeholder and is never invoked on this path.
 */
export function createMvtChunkCompiler(options: MvtChunkCompilerOptions): MvtChunkCompiler {
  const projector = createTangentProjector(options.origin);
  return async (key, request, context) => {
    const bounds = options.grid.boundsForKey(key);
    const southWest = projector.unproject({ x: bounds.minX, y: bounds.minY });
    const northEast = projector.unproject({ x: bounds.maxX, y: bounds.maxY });
    const tiles = tilesForBounds({ minLatitude: southWest.latitude, minLongitude: southWest.longitude, maxLatitude: northEast.latitude, maxLongitude: northEast.longitude }, MVT_TILE_ZOOM);
    const decodedTiles = [];
    for (const tile of tiles) {
      const decoded = await options.provider.getTile(tile, context.signal);
      if (decoded) decodedTiles.push({ tile, decoded });
    }
    const { region } = normalizeMvtTiles({ tiles: decodedTiles, origin: request.origin, regionId: request.regionId });
    const compiled = compileRegion(region, { signal: context.signal }).chunks[0];
    if (!compiled) throw new Error(`MVT compiler produced no chunk for ${key.x}:${key.y}`);
    const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
    const worldChunk = partitionCompiledChunk(translateCompiledChunk(compiled, center), options.grid, [key])[0];
    if (!worldChunk) throw new Error(`MVT compiler produced no geometry for ${key.x}:${key.y}`);
    return worldChunk;
  };
}
