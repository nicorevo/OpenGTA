import { describe, expect, it } from "vitest";
import { createChunkGrid } from "./grid.ts";
import { selectActiveChunks, sharedSeam } from "./window.ts";

describe("active chunk window", () => {
  const grid = createChunkGrid(100);

  it("prioritizes current, movement look-ahead and camera neighbors", () => {
    const demands = selectActiveChunks(grid, {
      position: { x: 10, y: 10 },
      velocity: { x: 120, y: 0 },
      cameraBounds: { minX: -50, minY: -50, maxX: 50, maxY: 50 },
    });

    expect(demands[0]).toMatchObject({ key: { x: 0, y: 0 }, priority: "P0" });
    expect(demands.find((demand) => demand.key.x === 1 && demand.key.y === 0)).toMatchObject({ priority: "P1" });
    expect(demands.find((demand) => demand.key.x === -1 && demand.key.y === -1)).toMatchObject({ priority: "P2" });
  });

  it("returns stable demands without duplicate keys", () => {
    const input = {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      cameraBounds: { minX: -100, minY: -100, maxX: 100, maxY: 100 },
    };
    const first = selectActiveChunks(grid, input);
    const second = selectActiveChunks(grid, input);
    expect(first).toEqual(second);
    expect(new Set(first.map((demand) => `${demand.key.x}:${demand.key.y}`)).size).toBe(first.length);
  });

  it("describes the shared boundary of adjacent chunks", () => {
    expect(sharedSeam(grid.boundsForKey({ x: 0, y: 0 }), grid.boundsForKey({ x: 1, y: 0 }))).toEqual({
      axis: "vertical", coordinate: 100, start: 0, end: 100,
    });
    expect(sharedSeam(grid.boundsForKey({ x: 0, y: 0 }), grid.boundsForKey({ x: 2, y: 0 }))).toBeUndefined();
  });
});
