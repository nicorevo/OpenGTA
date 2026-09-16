import { describe, it, expect } from "vitest";
import { projectBuildings, type BuildingInput } from "./building-projector.ts";
import type { Vec2 } from "../../../world/model/types.ts";

describe("building-projector", () => {
  const cameraPos: Vec2 = { x: 0, y: 0 };
  const cameraHeading = 0; // vehicle forward = +X (east), right = +Y

  it("projects nearby buildings and excludes distant ones", () => {
    // Vehicle frame at heading 0: forward = +X, right = +Y.
    const buildings: BuildingInput[] = [
      // 42m ahead, 26m right → visible
      { footprint: [{ x: 40, y: 24 }, { x: 45, y: 24 }, { x: 45, y: 29 }, { x: 40, y: 29 }], heightMeters: 10, isHistoric: false },
      // 28m ahead, 42m right → culled (lateral limit)
      { footprint: [{ x: 28, y: 40 }, { x: 33, y: 40 }, { x: 33, y: 45 }, { x: 28, y: 45 }], heightMeters: 12, isHistoric: false },
      // 30m behind, 10m right → culled (behind camera)
      { footprint: [{ x: -30, y: 10 }, { x: -25, y: 10 }, { x: -25, y: 15 }, { x: -30, y: 15 }], heightMeters: 8, isHistoric: false },
    ];
    const result = projectBuildings(buildings, cameraPos, cameraHeading);
    // Only the building 42m ahead and 26m right survives both culls
    expect(result).toHaveLength(1);
    for (const b of result) {
      expect(b.worldZ).toBeGreaterThan(0);
      expect(b.worldZ).toBeLessThanOrEqual(100);
    }
  });

  it("excludes buildings behind the camera", () => {
    // Behind the vehicle at heading 0 is -X
    const buildings: BuildingInput[] = [
      { footprint: [{ x: -20, y: 5 }, { x: -15, y: 5 }, { x: -15, y: 10 }, { x: -20, y: 10 }], heightMeters: 10, isHistoric: false },
    ];
    const result = projectBuildings(buildings, cameraPos, cameraHeading);
    expect(result).toHaveLength(0);
  });

  it("excludes buildings too far laterally", () => {
    // 50m to the right of the camera axis
    const buildings: BuildingInput[] = [
      { footprint: [{ x: 20, y: 50 }, { x: 25, y: 50 }, { x: 25, y: 55 }, { x: 20, y: 55 }], heightMeters: 10, isHistoric: false },
    ];
    const result = projectBuildings(buildings, cameraPos, cameraHeading);
    expect(result).toHaveLength(0);
  });

  it("projects a building straight ahead of the vehicle", () => {
    // 30m ahead, 3m right → on the road side, clearly visible
    const buildings: BuildingInput[] = [
      { footprint: [{ x: 30, y: 3 }, { x: 35, y: 3 }, { x: 35, y: 8 }, { x: 30, y: 8 }], heightMeters: 10, isHistoric: false },
    ];
    const result = projectBuildings(buildings, cameraPos, cameraHeading);
    expect(result).toHaveLength(1);
    expect(result[0].worldZ).toBeGreaterThan(25);
  });

  it("uses different colors for historic buildings", () => {
    const buildings: BuildingInput[] = [
      { footprint: [{ x: 20, y: 5 }, { x: 25, y: 5 }, { x: 25, y: 10 }, { x: 20, y: 10 }], heightMeters: 10, isHistoric: true },
    ];
    const result = projectBuildings(buildings, cameraPos, cameraHeading);
    expect(result).toHaveLength(1);
    expect(result[0].color).toBe(0xa86f5d); // historic color
  });

  it("clamps height to max 25m", () => {
    const buildings: BuildingInput[] = [
      { footprint: [{ x: 20, y: 5 }, { x: 25, y: 5 }, { x: 25, y: 10 }, { x: 20, y: 10 }], heightMeters: 100, isHistoric: false },
    ];
    const result = projectBuildings(buildings, cameraPos, cameraHeading);
    expect(result).toHaveLength(1);
    // Height should be clamped to 25m
    expect(result[0].projectedHeight).toBeLessThanOrEqual(25);
  });
});
