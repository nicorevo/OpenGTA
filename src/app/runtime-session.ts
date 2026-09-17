import type { PixiRenderer } from "../render/pixi/renderer.ts";
import type { PhysicsAdapter, PhysicsVehicleState } from "../physics/rapier/adapter.ts";
import type { VehicleInput } from "../gameplay/vehicle/controller.ts";
import { chooseSpawn } from "../gameplay/vehicle/spawn.ts";
import { isPoseAvailable, keysForVehicle } from "../world/chunk/availability.ts";
import { createChunkGrid, type ChunkKey } from "../world/chunk/grid.ts";
import { selectActiveChunks } from "../world/chunk/window.ts";
import { createChunkCache, type ChunkCache } from "../world/chunk/cache.ts";
import type { CompiledChunkV0 } from "../world/compiler/compiled.ts";
import { createOpenWorldRuntime, type OpenWorldRuntimeOptions } from "../world/runtime/open-world.ts";
import type { PersistentChunkStore } from "../world/chunk/persistent.ts";
import type { CanonicalRegionSource } from "../world/runtime/canonical-source.ts";
import type { GeoDataSource } from "../world/runtime/source.ts";
import { lodForZoom, type ZoomLevel } from "./camera.ts";

export type SessionState = "loading" | "ready" | "degraded" | "empty" | "error";
interface SessionRenderer extends Pick<PixiRenderer, "cameraBounds" | "updateVehicle" | "dispose"> { setChunk(chunk: CompiledChunkV0): void; removeChunk(chunkId: string): void; setZoom(level: ZoomLevel): void; zoomIn(): ZoomLevel; zoomOut(): ZoomLevel; cameraState(): { zoomLevel: ZoomLevel } }
export interface RuntimeSessionOptions {
  readonly source?: GeoDataSource;
  readonly regionSource?: CanonicalRegionSource;
  readonly sourceIdentity?: string;
  readonly queryProfile?: string;
  readonly origin: { readonly latitude: number; readonly longitude: number };
  readonly renderer: SessionRenderer;
  readonly physics: PhysicsAdapter;
  readonly cache?: ChunkCache<CompiledChunkV0>;
  readonly persistentStore?: PersistentChunkStore;
  readonly compile?: OpenWorldRuntimeOptions["compile"];
}

export function createRuntimeSession(options: RuntimeSessionOptions) {
  const grid = createChunkGrid(300);
  const chunks = new Map<string, { key: ChunkKey; chunk: CompiledChunkV0 }>();
  let vehicle: PhysicsVehicleState | undefined;
  let disposed = false;
  let finished = false;
  let fatal = false;
  const startedAt = performance.now();
  let firstPlayableMs: number | undefined;
  let lastChunkAppliedMs: number | undefined;
  let lastStreamAt = -Infinity;
  let lastDemand = "";
  const available = () => [...chunks.values()].map((entry) => entry.key);
  const values = () => [...chunks.values()].map((entry) => entry.chunk);
  const runtime = createOpenWorldRuntime({
    baseOrigin: options.origin, grid, cache: options.cache ?? createChunkCache(9), compilerVersion: "v0-runtime",
    source: options.source, regionSource: options.regionSource, sourceIdentity: options.sourceIdentity, queryProfile: options.queryProfile, persistentStore: options.persistentStore, compile: options.compile,
    onChunkReady(chunk, key) {
      if (disposed) return;
      const id = grid.idForKey(key); const previous = chunks.get(id);
      try {
        options.physics.setChunk(id, chunk.collisions);
        options.renderer.setChunk(chunk);
      } catch (error) {
        try {
          if (previous) options.physics.setChunk(id, previous.chunk.collisions); else options.physics.removeChunk(id);
          if (previous) options.renderer.setChunk(previous.chunk); else options.renderer.removeChunk(id);
        } catch { fatal = true; }
        throw error;
      }
      chunks.set(id, { key, chunk });
      lastChunkAppliedMs = performance.now() - startedAt;
      if (!vehicle) {
        const result = chooseSpawn({ chunks: values(), grid, available: available(), target: { x: 0, y: 0 }, isPoseFree: options.physics.isPoseFree });
        if (result.kind === "pose") {
          vehicle = options.physics.createVehicle({ ...result.pose.position, heading: result.pose.heading });
          firstPlayableMs = performance.now() - startedAt;
          options.renderer.updateVehicle(vehicle.position, vehicle.heading);
        }
      }
    },
    onChunkRemoved(key) {
      const id = grid.idForKey(key);
      const previous = chunks.get(id); if (!previous) return;
      try {
        options.physics.removeChunk(id); chunks.delete(id);
        options.renderer.removeChunk(id);
      } catch { fatal = true; }
    },
  });
  const stream = async (now: number, retry = false) => {
    if (disposed || fatal || !vehicle || (!retry && now - lastStreamAt < 200)) return;
    try {
      lastStreamAt = now;
      const input = { position: vehicle.position, velocity: vehicle.velocity, cameraBounds: options.renderer.cameraBounds() };
      const pinnedKeys = keysForVehicle(grid, vehicle);
      const signature = JSON.stringify([selectActiveChunks(grid, input).map((demand) => [demand.id, demand.priority]), pinnedKeys]);
      if (!retry && signature === lastDemand) return;
      lastDemand = signature;
      await runtime.loadWindow(input, { pinnedKeys, retry });
    } catch { if (!disposed) fatal = true; }
  };
  return {
    stream,
    retryMissing() { return stream(performance.now(), true); },
    async start() {
      try { await runtime.loadWindow({ position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, cameraBounds: { minX: -300, minY: -300, maxX: 300, maxY: 300 } }); }
      catch { if (!disposed) fatal = true; }
      finally { finished = true; }
    },
    zoomIn() { return options.renderer.zoomIn(); },
    zoomOut() { return options.renderer.zoomOut(); },
    step(input: VehicleInput) {
      if (disposed || fatal || !vehicle) return;
      const keys = available();
      vehicle = options.physics.stepVehicle(vehicle, input, (pose) => isPoseAvailable(grid, pose, keys));
      options.renderer.updateVehicle(vehicle.position, vehicle.heading);
    },
    vehicle() { return vehicle ? { position: { ...vehicle.position }, velocity: { ...vehicle.velocity }, heading: vehicle.heading } : undefined; },
    /** Expose active compiled chunks for external renderers (e.g. first-person). */
    getActiveChunks() { return (values() as unknown as CompiledChunkV0[]); },
    snapshot() {
      const diagnostic = runtime.snapshot();
      const hasErrors = Object.keys(diagnostic.errors).length > 0;
      const state: SessionState = fatal ? "error" : vehicle ? hasErrors ? "degraded" : "ready" : !finished ? "loading" : hasErrors ? "error" : "empty";
      const compiled = values();
      const zoomLevel = options.renderer.cameraState().zoomLevel;
      const source = options.regionSource?.diagnostics?.() ?? options.source?.diagnostics?.();
      return { state, runtime: diagnostic, source, firstPlayableMs, lastChunkAppliedMs, blocked: vehicle?.blockedByAvailability ?? false, zoomLevel, lodTier: lodForZoom(zoomLevel), colliders: options.physics.colliderCount(), regionId: compiled[0]?.spatial.regionId ?? "open-world", roads: compiled.reduce((sum, chunk) => sum + chunk.roads.length, 0), buildings: compiled.reduce((sum, chunk) => sum + chunk.buildings.length, 0), warnings: compiled.reduce((sum, chunk) => sum + chunk.diagnostics.warnings.length, 0), lastCompileMs: compiled.reduce((max, chunk) => Math.max(max, chunk.diagnostics.stageDurationsMs.compile ?? 0), 0), features: compiled.flatMap((chunk) => Object.keys(chunk.featureIndex)), pinned: vehicle ? keysForVehicle(grid, vehicle) : [] };
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      try { await runtime.dispose(); }
      finally { chunks.clear(); vehicle = undefined; options.physics.dispose(); options.renderer.dispose(); }
    },
  };
}

export type RuntimeSession = ReturnType<typeof createRuntimeSession>;
