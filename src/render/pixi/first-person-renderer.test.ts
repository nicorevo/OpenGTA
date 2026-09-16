import { describe, it, expect } from "vitest";
import { toRoadDepthItems, toBuildingDepthItems, extendNearestRoadToBottom, ROAD_FILL } from "./first-person-renderer.ts";
import type { RoadSegment } from "./first-person/road-projector.ts";
import type { ProjectedBuilding } from "./first-person/building-projector.ts";

const seg = (worldZ: number, leftScreenX: number, rightScreenX: number, screenY: number): RoadSegment => ({
  worldZ,
  leftScreenX,
  rightScreenX,
  screenWidth: rightScreenX - leftScreenX,
  screenY,
  worldLeftX: 0,
  worldRightX: 1,
});

describe("first-person depth items", () => {
  it("maps road segments to depth items, farthest segment touching the horizon", () => {
    const segments = [seg(80, 0.45, 0.55, 0.1), seg(40, 0.4, 0.6, 0.2), seg(10, 0.3, 0.7, 0.5)];
    const items = toRoadDepthItems(segments);

    expect(items).toHaveLength(3);
    expect(items[0].pixelYTop).toBe(0);
    expect(items[1].pixelYTop).toBe(0.1);
    expect(items[2].pixelYTop).toBe(0.2);
    expect(items[2].pixelYBottom).toBe(0.5);
    expect(items[2].pixelXLeft).toBe(0.3);
    expect(items[2].pixelXRight).toBe(0.7);
    for (const item of items) {
      expect(item.fill).toBe(0x53515a);
      expect(item.depth).toBeGreaterThan(0);
    }
  });

  it("strokes only the three nearest road segments", () => {
    const segments = [seg(90, 0.47, 0.53, 0.08), seg(80, 0.46, 0.54, 0.1), seg(60, 0.45, 0.55, 0.15), seg(40, 0.4, 0.6, 0.2), seg(10, 0.3, 0.7, 0.5)];
    const items = toRoadDepthItems(segments);

    expect(items[0].stroke).toBeNull();
    expect(items[1].stroke).toBeNull();
    expect(items[2].stroke).toBe(0x302e38);
    expect(items[3].stroke).toBe(0x302e38);
    expect(items[4].stroke).toBe(0x302e38);
  });

  it("extends the nearest road item to the bottom of the screen, leaving others untouched", () => {
    const roadItems = toRoadDepthItems([seg(80, 0.45, 0.55, 0.1), seg(10, 0.3, 0.7, 0.5)]);
    const buildingItem = toBuildingDepthItems([{
      screenPoints: [-0.5, 0.6, 0.1, 0.6, 0.1, 0.2, -0.5, 0.2],
      color: 0x806c61,
      worldZ: 5,
      projectedHeight: 10,
    }])[0];
    const items = [...roadItems, buildingItem];

    extendNearestRoadToBottom(items);

    const nearestRoad = items.filter((i) => i.fill === ROAD_FILL).reduce((a, b) => (a.depth < b.depth ? a : b));
    const farRoad = items.filter((i) => i.fill === ROAD_FILL).reduce((a, b) => (a.depth > b.depth ? a : b));
    expect(nearestRoad.pixelYBottom).toBe(1);
    expect(farRoad.pixelYBottom).toBe(0.1);
    expect(buildingItem.pixelYBottom).toBe(0.6);
  });

  it("is a no-op when there are no road items", () => {
    const items = toBuildingDepthItems([{
      screenPoints: [-0.5, 0.6, 0.1, 0.6, 0.1, 0.2, -0.5, 0.2],
      color: 0x806c61,
      worldZ: 5,
      projectedHeight: 10,
    }]);

    expect(() => extendNearestRoadToBottom(items)).not.toThrow();
    expect(items[0].pixelYBottom).toBe(0.6);
  });

  it("maps projected building faces into [0,1] screen space", () => {
    const building: ProjectedBuilding = {
      screenPoints: [-0.5, 0.6, 0.1, 0.6, 0.1, 0.2, -0.5, 0.2],
      color: 0x806c61,
      worldZ: 30,
      projectedHeight: 10,
    };
    const [item] = toBuildingDepthItems([building]);

    expect(item.pixelXLeft).toBeCloseTo(0.25);
    expect(item.pixelXRight).toBeCloseTo(0.55);
    expect(item.pixelYBottom).toBe(0.6);
    expect(item.pixelYTop).toBe(0.2);
    expect(item.fill).toBe(0x806c61);
    expect(item.stroke).toBeNull();
    expect(item.depth).toBe(30);
  });
});
