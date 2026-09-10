import { createTangentProjector } from "../../geo/coordinates/projector.ts";
import type { CompiledChunkV0 } from "../compiler/compiled.ts";
import { partitionCompiledChunk, translateCompiledChunk } from "../compiler/partition.ts";
import type { ChunkCache } from "../chunk/cache.ts";
import type { ChunkKey, ChunkGrid } from "../chunk/grid.ts";
import { createChunkLifecycle, type ChunkState, type ChunkLoadContext } from "../chunk/lifecycle.ts";
import { selectActiveChunks, type ActiveWindowInput, type ChunkDemand } from "../chunk/window.ts";
import { compileRuntimeRegion, type GeoDataSource, type RuntimeRegionRequest } from "./source.ts";

export interface OpenWorldRuntimeOptions {
  readonly baseOrigin: { readonly latitude: number; readonly longitude: number };
  readonly cache: ChunkCache<CompiledChunkV0>;
  readonly compilerVersion: string;
  readonly grid: ChunkGrid;
  readonly source: GeoDataSource;
  readonly sourceIdentity?: string;
  readonly queryProfile?: string;
  readonly compile?: (key: ChunkKey, request: RuntimeRegionRequest, context: ChunkLoadContext) => Promise<CompiledChunkV0>;
  readonly onChunkReady?: (chunk: CompiledChunkV0, key: ChunkKey) => void | Promise<void>;
  readonly onChunkRemoved?: (key: ChunkKey) => void | Promise<void>;
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
  loadWindow(input: ActiveWindowInput, options?: { readonly pinnedKeys?: readonly ChunkKey[]; readonly retry?: boolean }): Promise<ActiveWindowResult>;
  state(key: ChunkKey): ChunkState | undefined;
  snapshot(): RuntimeSnapshot;
  dispose(): Promise<void>;
}

export interface RuntimeSnapshot {
  readonly generation: number;
  readonly wanted: readonly string[];
  readonly pinned: readonly string[];
  readonly pending: readonly string[];
  readonly ready: readonly string[];
  readonly active: readonly string[];
  readonly errors: Readonly<Record<string, string>>;
  readonly records: number;
  readonly cacheSize: number;
}

const sourceIds = new WeakMap<GeoDataSource, number>();
let nextSourceId = 1;
function sourceId(source: GeoDataSource): number {
  if (!sourceIds.has(source)) sourceIds.set(source, nextSourceId++);
  return sourceIds.get(source)!;
}

export function createOpenWorldRuntime(options: OpenWorldRuntimeOptions): OpenWorldRuntime {
  if (!options.compilerVersion) throw new Error("Open World compiler version is required");
  const projector = createTangentProjector(options.baseOrigin);
  const namespace = JSON.stringify(["tangent-wgs84-v1", 0, options.baseOrigin.latitude, options.baseOrigin.longitude, options.grid.cellSizeMeters, options.sourceIdentity ?? ["instance", sourceId(options.source)], options.queryProfile ?? "v0"]);
  const signals = new Map<string, AbortSignal>();
  const lifecycle = createChunkLifecycle<CompiledChunkV0>(async (key, context) => {
    const id = options.grid.idForKey(key);
    signals.set(id, context.signal);
    const cached = options.cache.get({ namespace, chunkId: id, compilerVersion: options.compilerVersion });
    if (cached) return cached;
    const bounds = options.grid.boundsForKey(key);
    const request: RuntimeRegionRequest = {
      regionId: `open-world:${id}`,
      origin: projector.unproject({ x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }),
      radiusMeters: options.grid.cellSizeMeters,
    };
    const compiled = options.compile
      ? await options.compile(key, request, context)
      : (await compileRuntimeRegion(options.source, request, context)).chunks[0];
    context.signal.throwIfAborted();
    if (!compiled) throw new Error(`runtime compiler produced no chunk for ${id}`);
    const worldChunk = options.compile
      ? compiled
      : partitionCompiledChunk(translateCompiledChunk(compiled, {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2,
      }), options.grid, [key])[0];
    if (!worldChunk) throw new Error(`runtime compiler produced no geometry for ${id}`);
    options.cache.set({ namespace, chunkId: id, compilerVersion: options.compilerVersion }, worldChunk);
    return worldChunk;
  });

  const load = async (key: ChunkKey): Promise<CompiledChunkV0> => {
    const record = await lifecycle.load(key);
    if (!record.value) throw new Error(`chunk ${record.id} has no compiled value`);
    return record.value;
  };

  let generation = 0;
  let disposed = false;
  let wanted = new Map<string, ChunkDemand>();
  let pinned = new Map<string, ChunkKey>();
  const active = new Map<string, ChunkKey>();
  const pending = new Map<string, Promise<void>>();
  const errors = new Map<string, unknown>();
  let commits = Promise.resolve();
  const enqueue = (apply: () => Promise<void>) => {
    const result = commits.then(apply);
    commits = result.catch(() => {});
    return result;
  };
  const needed = (id: string) => !disposed && (wanted.has(id) || pinned.has(id));
  const priorityOf = (demand?: ChunkDemand) => demand?.priority === "P1" ? 1 : demand?.priority === "P2" ? 2 : 0;
  const removeObsolete = () => enqueue(async () => {
    for (const [id, key] of active) {
      if (needed(id)) continue;
      await options.onChunkRemoved?.(key); active.delete(id);
      if (!needed(id)) continue;
      // Re-demanded while removal was committing: re-apply from the warm cache.
      // Runs inside the commit chain, so scene and colliders stay serialized.
      try {
        const record = await lifecycle.load(key, { priority: priorityOf(wanted.get(id)) });
        if (!needed(id) || active.has(id) || !record.value || lifecycle.get(key)?.value !== record.value) continue;
        await options.onChunkReady?.(record.value, key);
        if (!needed(id) || lifecycle.get(key)?.value !== record.value) { await options.onChunkRemoved?.(key); continue; }
        lifecycle.activate(key); active.set(id, key);
      } catch (error) { if (needed(id)) errors.set(id, error); }
    }
  });
  const ensure = (demand: ChunkDemand): Promise<void> => {
    const { id, key } = demand;
    const priority = priorityOf(demand);
    const signal = signals.get(id); if (signal) options.source.promote?.(signal, priority);
    if (pending.has(id)) return pending.get(id)!;
    if (active.has(id) || errors.has(id)) return Promise.resolve();
    let work!: Promise<void>;
    work = (async () => {
      try {
        const record = await lifecycle.load(key, { priority });
        await enqueue(async () => {
          if (!needed(id) || active.has(id) || !record.value || lifecycle.get(key)?.value !== record.value) return;
          await options.onChunkReady?.(record.value, key);
          if (!needed(id) || lifecycle.get(key)?.value !== record.value) { await options.onChunkRemoved?.(key); return; }
          lifecycle.activate(key); active.set(id, key);
        });
      } catch (error) { if (needed(id) && pending.get(id) === work) errors.set(id, error); }
      finally {
        if (pending.get(id) === work) { pending.delete(id); signals.delete(id); }
      }
    })();
    pending.set(id, work);
    return work;
  };

  return {
    load,
    async loadWindow(input, windowOptions = {}) {
      if (disposed) throw new Error("Open world runtime disposed");
      const demands = selectActiveChunks(options.grid, input);
      generation++;
      wanted = new Map(demands.map((demand) => [demand.id, demand]));
      pinned = new Map((windowOptions.pinnedKeys ?? []).map((key) => [options.grid.idForKey(key), key]));
      if (pinned.size > 32) throw new Error("Too many pinned chunks");
      if (windowOptions.retry) errors.clear();
      for (const record of lifecycle.records()) {
        if (needed(record.id)) continue;
        lifecycle.release(record.key); errors.delete(record.id); pending.delete(record.id); signals.delete(record.id);
      }
      const removal = removeObsolete();
      const all = [...demands];
      for (const [id, key] of pinned) {
        if (!wanted.has(id)) all.push({ id, key, priority: "P0" });
      }
      await Promise.all([removal, ...all.map(ensure)]);
      return { loaded: demands.filter((demand) => active.has(demand.id)), failed: demands.filter((demand) => errors.has(demand.id)).map((demand) => ({ key: demand.key, error: errors.get(demand.id) })) };
    },
    state(key) {
      return lifecycle.get(key)?.state;
    },
    snapshot() {
      const records = lifecycle.records();
      return Object.freeze({ generation, wanted: Object.freeze([...wanted.keys()]), pinned: Object.freeze([...pinned.keys()]), pending: Object.freeze([...pending.keys()]), ready: Object.freeze(records.filter((record) => record.state === "READY").map((record) => record.id)), active: Object.freeze([...active.keys()]), errors: Object.freeze(Object.fromEntries([...errors].map(([id, error]) => [id, error && typeof error === "object" && "code" in error ? String(error.code) : "load-error"]))), records: records.length, cacheSize: options.cache.size });
    },
    async dispose() {
      disposed = true; generation++; wanted.clear(); pinned.clear(); errors.clear();
      lifecycle.dispose(); pending.clear(); signals.clear();
      await removeObsolete();
    },
  };
}
