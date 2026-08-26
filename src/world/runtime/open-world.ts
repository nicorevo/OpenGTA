import { createTangentProjector } from "../../geo/coordinates/projector.ts";
import type { CompiledChunkV0 } from "../compiler/compiled.ts";
import type { ChunkCache } from "../chunk/cache.ts";
import type { ChunkKey, ChunkGrid } from "../chunk/grid.ts";
import { createChunkLifecycle, type ChunkState } from "../chunk/lifecycle.ts";
import { selectActiveChunks, type ActiveWindowInput, type ChunkDemand } from "../chunk/window.ts";
import { compileRuntimeRegion, type GeoDataSource, type RuntimeRegionRequest } from "./source.ts";

export interface OpenWorldRuntimeOptions {
  readonly baseOrigin: { readonly latitude: number; readonly longitude: number };
  readonly cache: ChunkCache<CompiledChunkV0>;
  readonly compilerVersion: string;
  readonly grid: ChunkGrid;
  readonly source: GeoDataSource;
  readonly compile?: (key: ChunkKey, request: RuntimeRegionRequest) => Promise<CompiledChunkV0>;
}

export interface FailedChunkLoad {
  readonly key: ChunkKey;
  readonly error: unknown;
}

export interface ActiveWindowResult {
  readonly loaded: readonly ChunkDemand[];
  readonly failed: readonly FailedChunkLoad[];
}

export interface OpenWorldRuntime {
  load(key: ChunkKey): Promise<CompiledChunkV0>;
  loadWindow(input: ActiveWindowInput): Promise<ActiveWindowResult>;
  state(key: ChunkKey): ChunkState | undefined;
}

export function createOpenWorldRuntime(options: OpenWorldRuntimeOptions): OpenWorldRuntime {
  if (!options.compilerVersion) throw new Error("Open World compiler version is required");
  const projector = createTangentProjector(options.baseOrigin);
  const lifecycle = createChunkLifecycle<CompiledChunkV0>(async (key) => {
    const id = options.grid.idForKey(key);
    const cached = options.cache.get({ chunkId: id, compilerVersion: options.compilerVersion });
    if (cached) return cached;
    const bounds = options.grid.boundsForKey(key);
    const request: RuntimeRegionRequest = {
      regionId: `open-world:${id}`,
      origin: projector.unproject({ x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }),
      radiusMeters: options.grid.cellSizeMeters,
    };
    const compiled = options.compile
      ? await options.compile(key, request)
      : (await compileRuntimeRegion(options.source, request)).chunks[0];
    if (!compiled) throw new Error(`runtime compiler produced no chunk for ${id}`);
    options.cache.set({ chunkId: id, compilerVersion: options.compilerVersion }, compiled);
    return compiled;
  });

  const load = async (key: ChunkKey): Promise<CompiledChunkV0> => {
    const record = await lifecycle.load(key);
    if (!record.value) throw new Error(`chunk ${record.id} has no compiled value`);
    return record.value;
  };

  return {
    load,
    async loadWindow(input) {
      const demands = selectActiveChunks(options.grid, input);
      const loaded: ChunkDemand[] = [];
      const failed: FailedChunkLoad[] = [];
      const first = demands.find((demand) => demand.priority === "P0") ?? demands[0];
      if (!first) return { loaded, failed };
      try {
        await load(first.key);
        lifecycle.activate(first.key);
        loaded.push(first);
      } catch (error: unknown) {
        failed.push({ key: first.key, error });
        return { loaded, failed };
      }
      const neighbors = demands.filter((demand) => demand.id !== first.id);
      const results = await Promise.allSettled(neighbors.map(async (demand) => {
        await load(demand.key);
        lifecycle.activate(demand.key);
        return demand;
      }));
      results.forEach((result, index) => {
        const demand = neighbors[index];
        if (result.status === "fulfilled") loaded.push(result.value);
        else failed.push({ key: demand.key, error: result.reason });
      });
      return { loaded, failed };
    },
    state(key) {
      return lifecycle.get(key)?.state;
    },
  };
}
