import type { Bounds2D, Vec2 } from "../model/types.ts";
import type { ChunkGrid, ChunkKey } from "./grid.ts";

export type ChunkPriority = "P0" | "P1" | "P2";

export interface ActiveWindowInput {
  readonly position: Vec2;
  readonly velocity: Vec2;
  readonly cameraBounds: Bounds2D;
}

export interface ChunkDemand {
  readonly key: ChunkKey;
  readonly id: string;
  readonly priority: ChunkPriority;
}

export interface ChunkSeam {
  readonly axis: "vertical" | "horizontal";
  readonly coordinate: number;
  readonly start: number;
  readonly end: number;
}

const priorityRank: Record<ChunkPriority, number> = { P0: 0, P1: 1, P2: 2 };

function finiteBounds(bounds: Bounds2D): void {
  if (![bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(Number.isFinite) || bounds.minX >= bounds.maxX || bounds.minY >= bounds.maxY) {
    throw new Error("camera bounds must be finite and increasing");
  }
}

function cameraKeys(grid: ChunkGrid, bounds: Bounds2D): ChunkKey[] {
  const min = grid.keyForPoint({ x: bounds.minX, y: bounds.minY });
  const max = grid.keyForPoint({
    x: bounds.maxX - grid.cellSizeMeters * 1e-9,
    y: bounds.maxY - grid.cellSizeMeters * 1e-9,
  });
  const keys: ChunkKey[] = [];
  for (let y = min.y; y <= max.y; y += 1) {
    for (let x = min.x; x <= max.x; x += 1) keys.push({ x, y });
  }
  return keys;
}

export function selectActiveChunks(grid: ChunkGrid, input: ActiveWindowInput): readonly ChunkDemand[] {
  finiteBounds(input.cameraBounds);
  if (![input.position.x, input.position.y, input.velocity.x, input.velocity.y].every(Number.isFinite)) throw new Error("active window input must be finite");
  const demands = new Map<string, ChunkDemand>();
  const add = (key: ChunkKey, priority: ChunkPriority): void => {
    const id = grid.idForKey(key);
    const existing = demands.get(id);
    if (!existing || priorityRank[priority] < priorityRank[existing.priority]) demands.set(id, { key, id, priority });
  };
  const current = grid.keyForPoint(input.position);
  add(current, "P0");

  const speed = Math.hypot(input.velocity.x, input.velocity.y);
  if (speed > 0) {
    add(grid.keyForPoint({
      x: input.position.x + input.velocity.x / speed * grid.cellSizeMeters,
      y: input.position.y + input.velocity.y / speed * grid.cellSizeMeters,
    }), "P1");
  }
  for (const key of cameraKeys(grid, input.cameraBounds)) add(key, "P2");

  return [...demands.values()].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || a.key.y - b.key.y || a.key.x - b.key.x);
}

export function sharedSeam(first: Bounds2D, second: Bounds2D): ChunkSeam | undefined {
  const epsilon = 1e-9;
  const overlap = (aStart: number, aEnd: number, bStart: number, bEnd: number): [number, number] | undefined => {
    const start = Math.max(aStart, bStart);
    const end = Math.min(aEnd, bEnd);
    return end - start > epsilon ? [start, end] : undefined;
  };
  const vertical = overlap(first.minY, first.maxY, second.minY, second.maxY);
  if (vertical && Math.abs(first.maxX - second.minX) <= epsilon) return { axis: "vertical", coordinate: second.minX, start: vertical[0], end: vertical[1] };
  if (vertical && Math.abs(second.maxX - first.minX) <= epsilon) return { axis: "vertical", coordinate: first.minX, start: vertical[0], end: vertical[1] };
  const horizontal = overlap(first.minX, first.maxX, second.minX, second.maxX);
  if (horizontal && Math.abs(first.maxY - second.minY) <= epsilon) return { axis: "horizontal", coordinate: second.minY, start: horizontal[0], end: horizontal[1] };
  if (horizontal && Math.abs(second.maxY - first.minY) <= epsilon) return { axis: "horizontal", coordinate: first.minY, start: horizontal[0], end: horizontal[1] };
  return undefined;
}
