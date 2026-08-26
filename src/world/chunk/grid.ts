import type { Bounds2D, Vec2 } from "../model/types.ts";

export interface ChunkKey {
  readonly x: number;
  readonly y: number;
}

export interface ChunkGrid {
  readonly cellSizeMeters: number;
  keyForPoint(point: Vec2): ChunkKey;
  boundsForKey(key: ChunkKey): Bounds2D;
  neighbors(center: ChunkKey, radius: number): readonly ChunkKey[];
  idForKey(key: ChunkKey): string;
}

function validateKey(key: ChunkKey): void {
  if (!Number.isInteger(key.x) || !Number.isInteger(key.y)) throw new Error("chunk key must contain integers");
}

export function createChunkGrid(cellSizeMeters: number): ChunkGrid {
  if (!Number.isFinite(cellSizeMeters) || cellSizeMeters <= 0) throw new Error("chunk cell size must be positive and finite");

  return {
    cellSizeMeters,
    keyForPoint(point) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) throw new Error("chunk point must be finite");
      return { x: Math.floor(point.x / cellSizeMeters), y: Math.floor(point.y / cellSizeMeters) };
    },
    boundsForKey(key) {
      validateKey(key);
      const minX = key.x * cellSizeMeters;
      const minY = key.y * cellSizeMeters;
      return { minX, minY, maxX: minX + cellSizeMeters, maxY: minY + cellSizeMeters };
    },
    neighbors(center, radius) {
      validateKey(center);
      if (!Number.isInteger(radius) || radius < 0) throw new Error("chunk neighbor radius must be a non-negative integer");
      const keys: ChunkKey[] = [];
      for (let y = center.y - radius; y <= center.y + radius; y += 1) {
        for (let x = center.x - radius; x <= center.x + radius; x += 1) keys.push({ x, y });
      }
      return keys;
    },
    idForKey(key) {
      validateKey(key);
      return `chunk:${key.x}:${key.y}`;
    },
  };
}
