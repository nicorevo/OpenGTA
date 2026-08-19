import { describe, expect, it } from "vitest";
import { clipPolygonToBounds, clipPolylineToBounds } from "./clip.ts";

const bounds = { minX: -10, minY: -10, maxX: 10, maxY: 10 };
describe("world geometry clipping", () => {
  it("clips an oversized footprint to the V0 box", () => {
    const clipped = clipPolygonToBounds({ outer: [{ x: -20, y: -20 }, { x: 20, y: -20 }, { x: 20, y: 20 }, { x: -20, y: 20 }], holes: [] }, bounds);
    expect(clipped?.outer.every((point) => point.x >= -10 && point.x <= 10 && point.y >= -10 && point.y <= 10)).toBe(true);
  });
  it("clips a road centerline crossing the box", () => {
    expect(clipPolylineToBounds([{ x: -20, y: 0 }, { x: 20, y: 0 }], bounds)).toEqual([{ x: -10, y: 0 }, { x: 10, y: 0 }]);
  });
});
