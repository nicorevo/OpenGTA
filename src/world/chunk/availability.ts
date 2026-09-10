import { vehicleFootprint, type VehiclePose } from "../../gameplay/vehicle/shape.ts";
import type { ChunkGrid, ChunkKey } from "./grid.ts";

export const AVAILABILITY_MARGIN = 0.25;

// A conservative AABB includes internal cells, not just the four corners.
export function keysForVehicle(grid: ChunkGrid, pose: VehiclePose, margin = AVAILABILITY_MARGIN): readonly ChunkKey[] {
  if (!Number.isFinite(margin) || margin < 0) throw new Error("Invalid vehicle margin");
  const points = vehicleFootprint(pose, margin);
  const min = grid.keyForPoint({ x: Math.min(...points.map((p) => p.x)), y: Math.min(...points.map((p) => p.y)) });
  const max = grid.keyForPoint({ x: Math.max(...points.map((p) => p.x)), y: Math.max(...points.map((p) => p.y)) });
  if ((max.x - min.x + 1) * (max.y - min.y + 1) > 4096) throw new Error("Vehicle footprint exceeds grid budget");
  const keys: ChunkKey[] = [];
  for (let y = min.y; y <= max.y; y++) for (let x = min.x; x <= max.x; x++) keys.push({ x, y });
  return keys;
}

export function isPoseAvailable(grid: ChunkGrid, pose: VehiclePose, available: readonly ChunkKey[], margin = AVAILABILITY_MARGIN): boolean {
  const ids = new Set(available.map(grid.idForKey));
  return keysForVehicle(grid, pose, margin).every((key) => ids.has(grid.idForKey(key)));
}
