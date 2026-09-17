import { describe, expect, it } from "vitest";
import { clipPolygonToBounds } from "../model/clip.ts";
import type { Vec2 } from "../model/types.ts";
import { createChunkGrid } from "../chunk/grid.ts";
import { partitionCompiledChunk, ownerKeyForFeature } from "./partition.ts";
import type { CompiledChunkV0 } from "./compiled.ts";

/**
 * Independent reference: the road ribbon around a centerline (mirrors the
 * compiler's surface builder), used to pin the per-fragment surface semantics.
 */
function ribbon(points: readonly Vec2[], width: number): { outer: Vec2[]; holes: Vec2[][] } | undefined {
  if (points.length < 2 || !Number.isFinite(width) || width <= 0) return undefined;
  const half = width / 2;
  const normals: Vec2[] = [];
  const vertices: Vec2[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (!length) continue;
    normals.push({ x: (-dy / length) * half, y: (dx / length) * half });
    if (vertices.length === 0) vertices.push(a);
    vertices.push(b);
  }
  if (normals.length === 0) return undefined;
  const left: Vec2[] = [];
  const right: Vec2[] = [];
  for (let i = 0; i < vertices.length; i += 1) {
    const vertex = vertices[i];
    const before = normals[Math.max(0, i - 1)];
    const after = normals[Math.min(i, normals.length - 1)];
    left.push({ x: vertex.x + before.x, y: vertex.y + before.y });
    right.push({ x: vertex.x - before.x, y: vertex.y - before.y });
    if (Math.hypot(after.x - before.x, after.y - before.y) > 1e-9) {
      left.push({ x: vertex.x + after.x, y: vertex.y + after.y });
      right.push({ x: vertex.x - after.x, y: vertex.y - after.y });
    }
  }
  if (left.length < 2) return undefined;
  return { outer: [...left, ...right.reverse()], holes: [] };
}

/** Even-odd ray casting: is the point inside the polygon ring? */
function containsPolygon(ring: readonly Vec2[], point: Vec2): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

const chunk: CompiledChunkV0 = {
  schemaVersion: 0,
  id: "region:chunk:0",
  spatial: { regionId: "region", bounds: { minX: -100, minY: -100, maxX: 100, maxY: 100 }, originOffset: { x: 0, y: 0 } },
  ground: [{ featureId: "land:1", area: { outer: [{ x: -150, y: -50 }, { x: 150, y: -50 }, { x: 150, y: 50 }, { x: -150, y: 50 }], holes: [] }, styleKey: "land:grass" }],
  roads: [{ featureId: "road:1", surface: { outer: [{ x: -150, y: -5 }, { x: 150, y: -5 }, { x: 150, y: 5 }, { x: -150, y: 5 }], holes: [] }, centerline: [{ x: -150, y: 0 }, { x: 150, y: 0 }], widthMeters: 10, styleKey: "road:primary" }],
  buildings: [], labels: [], collisions: [], featureIndex: { "land:1": { kind: "land" }, "road:1": { kind: "road" } },
  diagnostics: { inputFeatureCount: 2, compiledFeatureCount: 2, skippedFeatureCount: 0, warnings: [], stageDurationsMs: { total: 0 } },
};

describe("compiled chunk partition", () => {
  it("keeps crossing feature IDs while clipping geometry into both cells", () => {
    const parts = partitionCompiledChunk(chunk, createChunkGrid(200), [{ x: -1, y: 0 }, { x: 0, y: 0 }]);

    expect(parts).toHaveLength(2);
    expect(parts[0]?.ground[0]?.featureId).toBe("land:1");
    expect(parts[1]?.ground[0]?.featureId).toBe("land:1");
    expect(parts[0]?.roads[0]?.featureId).toBe("road:1");
    expect(parts[1]?.roads[0]?.featureId).toBe("road:1");
    expect(parts[0]?.spatial.bounds).toEqual({ minX: -200, minY: 0, maxX: 0, maxY: 200 });
    expect(parts[1]?.spatial.bounds).toEqual({ minX: 0, minY: 0, maxX: 200, maxY: 200 });
  });

  it("assigns a stable owner from the feature anchor", () => {
    const grid = createChunkGrid(200);
    expect(ownerKeyForFeature(grid, { x: 25, y: 25 })).toEqual({ x: 0, y: 0 });
    expect(ownerKeyForFeature(grid, { x: 225, y: 25 })).toEqual({ x: 1, y: 0 });
  });

  it("gives each fragment of a U-shaped road its own surface (no bridge across the notch)", () => {
    // A U opening downward whose curve dips below the cell: the centerline
    // clips to two fragments (one arm each) inside the [0,200]^2 cell, while
    // the way's single surface spans both arms.
    const uCenterline: Vec2[] = [
      { x: 30, y: 250 }, { x: 30, y: 10 }, { x: 35, y: -10 }, { x: 45, y: -15 },
      { x: 55, y: -15 }, { x: 65, y: -10 }, { x: 70, y: 10 }, { x: 70, y: 250 },
    ];
    const uChunk: CompiledChunkV0 = {
      ...chunk,
      roads: [{ featureId: "road:u", surface: ribbon(uCenterline, 10)!, centerline: uCenterline, widthMeters: 10, styleKey: "road:primary" }],
    };

    const parts = partitionCompiledChunk(uChunk, createChunkGrid(200), [{ x: 0, y: 0 }]);
    const roads = parts[0]?.roads ?? [];
    expect(roads).toHaveLength(2);

    const bounds = parts[0]!.spatial.bounds;
    for (const road of roads) {
      // The surface must match the ribbon of this fragment's own centerline.
      const reference = clipPolygonToBounds(ribbon(road.centerline, road.widthMeters)!, bounds)!;
      expect(road.surface).toEqual(reference);
    }

    const leftRoad = roads.find((road) => road.centerline[0]!.x < 50)!;
    const rightRoad = roads.find((road) => road.centerline[0]!.x > 50)!;
    // Each fragment paints only its own arm: never the other arm and never
    // the notch between them (the shared clipped surface bridged it).
    expect(containsPolygon(leftRoad.surface.outer, { x: 30, y: 100 })).toBe(true);
    expect(containsPolygon(leftRoad.surface.outer, { x: 70, y: 100 })).toBe(false);
    expect(containsPolygon(leftRoad.surface.outer, { x: 50, y: 100 })).toBe(false);
    expect(containsPolygon(rightRoad.surface.outer, { x: 70, y: 100 })).toBe(true);
    expect(containsPolygon(rightRoad.surface.outer, { x: 30, y: 100 })).toBe(false);
    expect(containsPolygon(rightRoad.surface.outer, { x: 50, y: 100 })).toBe(false);
  });
});
