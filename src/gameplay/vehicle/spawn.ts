import type { CompiledChunkV0 } from "../../world/compiler/compiled.ts";
import { createFootprintIndex, isBuiltUp } from "../../world/compiler/road-fit.ts";
import { isPoseAvailable } from "../../world/chunk/availability.ts";
import type { ChunkGrid, ChunkKey } from "../../world/chunk/grid.ts";
import type { Vec2 } from "../../world/model/types.ts";
import { VEHICLE_HALF_LENGTH, VEHICLE_HALF_WIDTH, vehicleFootprint, type VehiclePose } from "./shape.ts";

export interface SpawnOptions {
  readonly chunks: readonly CompiledChunkV0[];
  readonly grid: ChunkGrid;
  readonly available: readonly ChunkKey[];
  readonly target: Vec2;
  readonly isPoseFree: (pose: VehiclePose) => boolean;
}
export type SpawnResult = { readonly kind: "pose"; readonly pose: VehiclePose } | { readonly kind: "no-spawn"; readonly reason: "no-roads" | "blocked" };

export function chooseSpawn(options: SpawnOptions): SpawnResult {
  const roads = options.chunks.flatMap((chunk) => chunk.roads);
  if (!roads.length) return { kind: "no-spawn", reason: "no-roads" };
  const occupied = createFootprintIndex(options.chunks.flatMap((chunk) => [
    ...chunk.collisions.flatMap((shape) => shape.kind === "polygon" ? [shape.polygon] : []),
    ...chunk.ground.filter((area) => area.styleKey.startsWith("water:")).map((area) => area.area),
  ]));
  type Candidate = { pose: VehiclePose; distance: number; id: string };
  const candidates: Candidate[] = [];
  const compare = (a: Candidate, b: Candidate) => a.distance - b.distance || a.id.localeCompare(b.id) || a.pose.position.x - b.pose.position.x || a.pose.position.y - b.pose.position.y || a.pose.heading - b.pose.heading;
  for (const road of roads) {
    if (road.widthMeters < 2 * VEHICLE_HALF_WIDTH + 0.5) continue;
    for (let index = 1; index < road.centerline.length; index++) {
      const a = road.centerline[index - 1]; const b = road.centerline[index];
      const dx = b.x - a.x; const dy = b.y - a.y; const length = Math.hypot(dx, dy);
      if (!Number.isFinite(length) || length < 2 * (VEHICLE_HALF_LENGTH + 0.25)) continue;
      const inset = (VEHICLE_HALF_LENGTH + 0.5) / length;
      const nearest = Math.max(inset, Math.min(1 - inset, ((options.target.x - a.x) * dx + (options.target.y - a.y) * dy) / (length * length)));
      for (const t of new Set([nearest, inset, 0.5, 1 - inset])) {
        const position = { x: a.x + dx * t, y: a.y + dy * t };
        candidates.push({ id: road.featureId, pose: { position, heading: Math.atan2(dy, dx) }, distance: Math.hypot(position.x - options.target.x, position.y - options.target.y) });
        candidates.sort(compare); if (candidates.length > 128) candidates.pop();
      }
    }
  }
  for (const { pose } of candidates) {
    if (!isPoseAvailable(options.grid, pose, options.available)) continue;
    if ([pose.position, ...vehicleFootprint(pose)].some((point) => isBuiltUp(occupied, point))) continue;
    if (options.isPoseFree(pose)) return { kind: "pose", pose };
  }
  return { kind: "no-spawn", reason: "blocked" };
}
