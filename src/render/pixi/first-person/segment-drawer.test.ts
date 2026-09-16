import { describe, it, expect, vi } from "vitest";
import { drawRoadSegments } from "./segment-drawer.ts";
import type { RoadSegment } from "./road-projector.ts";

describe("segment-drawer", () => {
  it("draws a straight road with back-to-front segments", () => {
    const segments: RoadSegment[] = [
      { worldZ: 40, leftScreenX: 0.4, rightScreenX: 0.6, screenWidth: 0.2, screenY: 0.3, worldLeftX: -3, worldRightX: 3 },
      { worldZ: 30, leftScreenX: 0.35, rightScreenX: 0.65, screenWidth: 0.3, screenY: 0.5, worldLeftX: -3, worldRightX: 3 },
      { worldZ: 20, leftScreenX: 0.3, rightScreenX: 0.7, screenWidth: 0.4, screenY: 0.7, worldLeftX: -3, worldRightX: 3 },
      { worldZ: 10, leftScreenX: 0.25, rightScreenX: 0.75, screenWidth: 0.5, screenY: 0.9, worldLeftX: -3, worldRightX: 3 },
    ];

    // Just verify it doesn't throw and the Graphics receives calls
    const graphics = {} as any;
    graphics.clear = vi.fn();
    graphics.poly = vi.fn().mockReturnThis();
    graphics.fill = vi.fn().mockReturnThis();
    graphics.stroke = vi.fn().mockReturnThis();
    graphics.moveTo = vi.fn().mockReturnThis();
    graphics.lineTo = vi.fn().mockReturnThis();

    drawRoadSegments(graphics, segments, 800, 600);

    // Should call fill for each segment
    expect(graphics.fill).toHaveBeenCalled();
  });

  it("uses ROAD_FILL color for asphalt", () => {
    const segments: RoadSegment[] = [
      { worldZ: 10, leftScreenX: 0.3, rightScreenX: 0.7, screenWidth: 0.4, screenY: 0.9, worldLeftX: -3, worldRightX: 3 },
    ];

    const graphics = {} as any;
    graphics.clear = vi.fn();
    const fills: number[] = [];
    graphics.poly = vi.fn().mockReturnThis();
    graphics.fill = vi.fn((color) => { fills.push(color); return graphics; });
    graphics.stroke = vi.fn().mockReturnThis();
    graphics.moveTo = vi.fn().mockReturnThis();
    graphics.lineTo = vi.fn().mockReturnThis();

    drawRoadSegments(graphics, segments, 800, 600);

    // Should include ROAD_FILL color (0x53515a)
    expect(fills).toContain(0x53515a);
  });

  it("draws edge strokes on first 3 segments only", () => {
    const segments: RoadSegment[] = [
      { worldZ: 10, leftScreenX: 0.3, rightScreenX: 0.7, screenWidth: 0.4, screenY: 0.9, worldLeftX: -3, worldRightX: 3 },
      { worldZ: 20, leftScreenX: 0.35, rightScreenX: 0.65, screenWidth: 0.3, screenY: 0.7, worldLeftX: -3, worldRightX: 3 },
      { worldZ: 30, leftScreenX: 0.38, rightScreenX: 0.62, screenWidth: 0.24, screenY: 0.55, worldLeftX: -3, worldRightX: 3 },
      { worldZ: 40, leftScreenX: 0.4, rightScreenX: 0.6, screenWidth: 0.2, screenY: 0.4, worldLeftX: -3, worldRightX: 3 },
      { worldZ: 50, leftScreenX: 0.41, rightScreenX: 0.59, screenWidth: 0.18, screenY: 0.35, worldLeftX: -3, worldRightX: 3 },
    ];

    const graphics = {} as any;
    graphics.clear = vi.fn();
    graphics.poly = vi.fn().mockReturnThis();
    graphics.fill = vi.fn().mockReturnThis();
    graphics.stroke = vi.fn().mockReturnThis();
    graphics.moveTo = vi.fn().mockReturnThis();
    graphics.lineTo = vi.fn().mockReturnThis();

    drawRoadSegments(graphics, segments, 800, 600);

    // Should call stroke for first 3 segments (2 edges each = 6 calls)
    expect(graphics.stroke).toHaveBeenCalledTimes(6);
  });
});
