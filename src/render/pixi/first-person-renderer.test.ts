import { describe, it, expect } from "vitest";
import { ndcToScreen, toBuildingDrawItem, toRoadDrawItem, ROAD_FILL } from "./first-person-renderer.ts";
import { projectRoadPolygon } from "./first-person/road-projector.ts";
import { projectBuildings } from "./first-person/building-projector.ts";
import { DEFAULT_CAMERA_CONFIG } from "./first-person/camera3d.ts";
import type { Vec2 } from "../../world/model/types.ts";

describe("first-person screen mapping", () => {
  it("maps NDC -1..1 to the canvas corners", () => {
    expect(ndcToScreen(-1, -1, 1920, 1080)).toEqual({ x: 0, y: 0 });
    expect(ndcToScreen(1, 1, 1920, 1080)).toEqual({ x: 1920, y: 1080 });
  });

  it("places the horizon (NDC sy 0) at the vertical middle of the screen", () => {
    expect(ndcToScreen(0, 0, 100, 100)).toEqual({ x: 50, y: 50 });
  });

  it("maps a projected road polygon to a screen draw item", () => {
    const poly = projectRoadPolygon(
      [{ x: 0, y: 0 }, { x: 40, y: 0 }] as Vec2[],
      6,
      { x: 0, y: 0 },
      0,
      DEFAULT_CAMERA_CONFIG,
    );
    expect(poly).not.toBeNull();
    const item = toRoadDrawItem(poly!, 1000, 1000);
    if (item.kind !== "road") throw new Error("expected a road draw item");
    expect(item.depth).toBeGreaterThanOrEqual(DEFAULT_CAMERA_CONFIG.nearClip - 1e-6);
    // Near end is below the bottom of the screen, far end near the horizon.
    const ys = item.points.map((p) => p.y);
    expect(Math.max(...ys)).toBeGreaterThan(1000);
    expect(Math.min(...ys)).toBeGreaterThan(490);
    expect(ROAD_FILL).toBe(0x53515a);
  });

  it("maps a projected building box to a screen draw item with walls and roof", () => {
    const footprint: Vec2[] = [
      { x: 25, y: -5 },
      { x: 35, y: -5 },
      { x: 35, y: 5 },
      { x: 25, y: 5 },
    ];
    const [box] = projectBuildings([{ footprint, heightMeters: 8, isHistoric: false }], { x: 0, y: 0 }, 0, DEFAULT_CAMERA_CONFIG);
    expect(box).toBeDefined();
    const item = toBuildingDrawItem(box!, 1000, 1000);
    if (item.kind !== "building") throw new Error("expected a building draw item");
    expect(item.depth).toBeCloseTo(25, 5);
    expect(item.parts).toHaveLength(2);
    const [wall, roof] = item.parts;
    expect(wall.fill).not.toBe(roof.fill);
    // Wall bottoms are below the horizon (screen y > 500 on a 1000px canvas).
    expect(Math.max(...wall.points.map((p) => p.y))).toBeGreaterThan(500);
    // The roof is above the wall bottoms.
    expect(Math.max(...roof.points.map((p) => p.y))).toBeLessThan(Math.max(...wall.points.map((p) => p.y)));
  });
});
