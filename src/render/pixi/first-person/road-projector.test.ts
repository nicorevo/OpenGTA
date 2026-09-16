import { describe, it, expect } from "vitest";
import { projectRoadSegments } from "./road-projector.ts";
import { DEFAULT_CAMERA_CONFIG } from "./camera3d.ts";
import type { Vec2 } from "../../../world/model/types.ts";

describe("road-projector", () => {
  const cameraPos: Vec2 = { x: 0, y: 0 };

  it("projects a road along the vehicle forward into center-screen segments", () => {
    // Vehicle convention: forward = (cos heading, sin heading), so heading 0
    // faces +X. A road along +X is straight ahead.
    const centerline: Vec2[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
      { x: 40, y: 0 },
    ];
    const segments = projectRoadSegments(centerline, 6, cameraPos, 0, DEFAULT_CAMERA_CONFIG);
    expect(segments).toHaveLength(4);
    // Segments sorted back-to-front (farther first)
    for (let i = 0; i < segments.length - 1; i++) {
      expect(segments[i].worldZ).toBeGreaterThanOrEqual(segments[i + 1].worldZ);
    }
    // Straight-ahead road: edges straddle screen center (0.5 in [0,1] space)
    for (const seg of segments) {
      expect(seg.leftScreenX).toBeLessThan(0.5);
      expect(seg.rightScreenX).toBeGreaterThan(0.5);
    }
    // All segments have positive width
    for (const seg of segments) {
      expect(seg.screenWidth).toBeGreaterThan(0);
    }
  });

  it("narrows segment width with distance", () => {
    const centerline: Vec2[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
      { x: 40, y: 0 },
    ];
    const segments = projectRoadSegments(centerline, 6, cameraPos, 0, DEFAULT_CAMERA_CONFIG);
    // Segments sorted back-to-front (farthest first), so last is closest
    expect(segments[segments.length - 1].screenWidth).toBeGreaterThan(segments[0].screenWidth);
  });

  it("rejects segments behind the camera", () => {
    // Heading 0: behind the vehicle is -X
    const centerline: Vec2[] = [
      { x: -30, y: 0 },
      { x: -20, y: 0 },
      { x: -10, y: 0 },
    ];
    const segments = projectRoadSegments(centerline, 6, cameraPos, 0, DEFAULT_CAMERA_CONFIG);
    expect(segments).toHaveLength(0);
  });

  it("rejects segments beyond far clip", () => {
    const centerline: Vec2[] = [
      { x: 200, y: 0 },
      { x: 210, y: 0 },
      { x: 220, y: 0 },
      { x: 230, y: 0 },
    ];
    const segments = projectRoadSegments(centerline, 6, cameraPos, 0, DEFAULT_CAMERA_CONFIG);
    expect(segments).toHaveLength(0);
  });

  it("projects a road running laterally as sideways, not ahead", () => {
    // Heading 0 (forward +X): a road along +Y passes to the vehicle's side.
    // Every centerline point sits in the camera plane (z = 0) → nothing ahead.
    const centerline: Vec2[] = [
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 0, y: 20 },
      { x: 0, y: 30 },
    ];
    const segments = projectRoadSegments(centerline, 6, cameraPos, 0, DEFAULT_CAMERA_CONFIG);
    expect(segments).toHaveLength(0);
  });

  it("rotates segments to follow camera heading", () => {
    // Heading PI/2 → forward = +Y. A road along +Y is now straight ahead.
    const northRoad: Vec2[] = [
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 0, y: 20 },
      { x: 0, y: 30 },
    ];
    const segments = projectRoadSegments(northRoad, 6, cameraPos, Math.PI / 2, DEFAULT_CAMERA_CONFIG);
    expect(segments).toHaveLength(3);
    for (const seg of segments) {
      expect(seg.leftScreenX).toBeLessThan(0.5);
      expect(seg.rightScreenX).toBeGreaterThan(0.5);
    }
  });

  it("places a road offset to the vehicle's left on the left of the screen", () => {
    // Heading 0 (forward +X, left = -Y): a road 10m to the left runs ahead
    // but its projected edges stay left of screen center.
    const leftRoad: Vec2[] = [
      { x: 0, y: -10 },
      { x: 10, y: -10 },
      { x: 20, y: -10 },
      { x: 30, y: -10 },
      { x: 40, y: -10 },
    ];
    const segments = projectRoadSegments(leftRoad, 6, cameraPos, 0, DEFAULT_CAMERA_CONFIG);
    expect(segments.length).toBeGreaterThan(0);
    for (const seg of segments) {
      expect(seg.leftScreenX).toBeLessThan(0.5);
    }
  });
});
