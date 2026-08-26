import { describe, expect, it } from "vitest";
import { createChunkGrid } from "./grid.ts";

describe("chunk grid", () => {
  const grid = createChunkGrid(100);

  it("assigns points to deterministic cells, including negative coordinates", () => {
    expect(grid.keyForPoint({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(grid.keyForPoint({ x: 99.999, y: -0.001 })).toEqual({ x: 0, y: -1 });
    expect(grid.keyForPoint({ x: -100, y: 200 })).toEqual({ x: -1, y: 2 });
  });

  it("uses half-open bounds so adjacent chunks do not overlap", () => {
    expect(grid.boundsForKey({ x: -1, y: 2 })).toEqual({ minX: -100, minY: 200, maxX: 0, maxY: 300 });
    expect(grid.keyForPoint({ x: 0, y: 200 })).toEqual({ x: 0, y: 2 });
  });

  it("returns neighboring keys in stable row-major order", () => {
    expect(grid.neighbors({ x: 0, y: 0 }, 1)).toEqual([
      { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
      { x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 },
      { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 },
    ]);
    expect(grid.idForKey({ x: -2, y: 3 })).toBe("chunk:-2:3");
  });

  it("rejects a non-positive or non-finite cell size", () => {
    expect(() => createChunkGrid(0)).toThrow("cell size");
    expect(() => createChunkGrid(Number.NaN)).toThrow("cell size");
  });
});
