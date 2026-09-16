import { describe, it, expect } from "vitest";
import { projectRoadPolygon } from "./road-projector.ts";
import { DEFAULT_CAMERA_CONFIG } from "./camera3d.ts";
import type { Vec2 } from "../../../world/model/types.ts";

const span = (points: readonly { sx: number; sy: number }[], pick: (p: { sx: number; sy: number }) => number): number => {
  const values = points.map(pick);
  return Math.max(...values) - Math.min(...values);
};
const atExtreme = (points: readonly { sx: number; sy: number }[], pick: (p: { sx: number; sy: number }) => number, which: "min" | "max"): { sx: number; sy: number }[] => {
  const target = which === "min" ? Math.min(...points.map(pick)) : Math.max(...points.map(pick));
  return points.filter((p) => Math.abs(pick(p) - target) < 1e-9);
};

describe("road-projector (ground polygon model)", () => {
  const cameraPos: Vec2 = { x: 0, y: 0 };
  const straightAhead: Vec2[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 0 },
    { x: 30, y: 0 },
    { x: 40, y: 0 },
  ];

  it("projects a straight-ahead road as a polygon straddling screen center", () => {
    const poly = projectRoadPolygon(straightAhead, 6, cameraPos, 0, DEFAULT_CAMERA_CONFIG);
    expect(poly).not.toBeNull();
    expect(poly!.points.length).toBeGreaterThanOrEqual(6);

    // Near edge (largest sy) must be wider than the far edge (smallest sy).
    const near = atExtreme(poly!.points, (p) => p.sy, "max");
    const far = atExtreme(poly!.points, (p) => p.sy, "min");
    expect(span(near, (p) => p.sx)).toBeGreaterThan(span(far, (p) => p.sx));

    // Straight ahead: both edges straddle the NDC center (0).
    expect(Math.min(...poly!.points.map((p) => p.sx))).toBeLessThan(0);
    expect(Math.max(...poly!.points.map((p) => p.sx))).toBeGreaterThan(0);

    // The road starts at the camera: its nearest vertex sits at the near clip.
    expect(poly!.depth).toBeGreaterThanOrEqual(DEFAULT_CAMERA_CONFIG.nearClip - 1e-6);
    expect(poly!.depth).toBeLessThan(5);
  });

  it("narrows the far end with distance (true perspective)", () => {
    const poly = projectRoadPolygon([{ x: 30, y: 0 }, { x: 60, y: 0 }], 6, cameraPos, 0, DEFAULT_CAMERA_CONFIG);
    expect(poly).not.toBeNull();
    const far = atExtreme(poly!.points, (p) => p.sy, "min");
    // Far end at z=60 with a 6 m road: sx span = 6 / 60 / tan(30deg).
    expect(span(far, (p) => p.sx)).toBeCloseTo(6 / 60 / Math.tan(Math.PI / 6), 5);
  });

  it("projects a crossing road ahead as a thin band, not a ground-filling fan", () => {
    // Heading 0 (forward +X): a road running along Y at x=70 crosses the view.
    // The old strip model fanned its segments over the whole ground; the
    // polygon must stay a thin band near the horizon.
    const crossing: Vec2[] = [];
    for (let y = -60; y <= 60; y += 10) crossing.push({ x: 70, y });
    const poly = projectRoadPolygon(crossing, 7, cameraPos, 0, DEFAULT_CAMERA_CONFIG);
    expect(poly).not.toBeNull();
    expect(span(poly!.points, (p) => p.sy)).toBeLessThan(0.35);
    // The road's 7 m width offsets the edges along its normal (the camera
    // axis here), so the nearest polygon vertex is 3.5 m closer than the
    // centerline.
    expect(poly!.depth).toBeCloseTo(66.5, 0);
  });

  it("returns null for a road entirely behind the camera", () => {
    const poly = projectRoadPolygon([{ x: -30, y: 0 }, { x: -10, y: 0 }], 6, cameraPos, 0, DEFAULT_CAMERA_CONFIG);
    expect(poly).toBeNull();
  });

  it("returns null for a road entirely beyond the far clip", () => {
    const poly = projectRoadPolygon([{ x: 200, y: 0 }, { x: 230, y: 0 }], 6, cameraPos, 0, DEFAULT_CAMERA_CONFIG);
    expect(poly).toBeNull();
  });

  it("clips the near end at the camera plane when the road passes under the vehicle", () => {
    const poly = projectRoadPolygon([{ x: -5, y: 0 }, { x: 50, y: 0 }], 6, cameraPos, 0, DEFAULT_CAMERA_CONFIG);
    expect(poly).not.toBeNull();
    const nearSy = DEFAULT_CAMERA_CONFIG.cameraHeight / (DEFAULT_CAMERA_CONFIG.nearClip * Math.tan(Math.PI / 6));
    // No vertex may sit closer than the near clip (its sy would exceed the
    // near-clip sy), and the clipped near edge must exist at exactly that sy.
    for (const p of poly!.points) {
      expect(p.sy).toBeLessThanOrEqual(nearSy + 1e-6);
    }
    const maxSy = Math.max(...poly!.points.map((p) => p.sy));
    expect(maxSy).toBeGreaterThanOrEqual(nearSy - 1e-6);
    // The near end projects below the bottom of the screen (sy > 1).
    expect(maxSy).toBeGreaterThan(1);
  });

  it("offsets the road width in world space, not camera space", () => {
    // Heading 0: +X forward, right = +Y, left = -Y. A road 50 m to the left
    // must project fully left of the NDC center, width preserved.
    const leftRoad: Vec2[] = [{ x: 0, y: -50 }, { x: 50, y: -50 }];
    const poly = projectRoadPolygon(leftRoad, 6, cameraPos, 0, DEFAULT_CAMERA_CONFIG);
    expect(poly).not.toBeNull();
    for (const p of poly!.points) expect(p.sx).toBeLessThan(0);
  });

  it("rotates with the camera heading", () => {
    // Heading PI/2 → forward = +Y. A road along +Y is straight ahead.
    const northRoad: Vec2[] = [{ x: 0, y: 0 }, { x: 0, y: 40 }];
    const poly = projectRoadPolygon(northRoad, 6, cameraPos, Math.PI / 2, DEFAULT_CAMERA_CONFIG);
    expect(poly).not.toBeNull();
    expect(Math.min(...poly!.points.map((p) => p.sx))).toBeLessThan(0);
    expect(Math.max(...poly!.points.map((p) => p.sx))).toBeGreaterThan(0);
  });

  it("densifies sparse centerlines so the polygon stays continuous", () => {
    // A 2-point centerline spanning 82 m (MVT style) must yield a polygon
    // with many vertices along both edges.
    const poly = projectRoadPolygon([{ x: -2, y: 0 }, { x: 80, y: 0 }], 6, cameraPos, 0, DEFAULT_CAMERA_CONFIG);
    expect(poly).not.toBeNull();
    expect(poly!.points.length).toBeGreaterThanOrEqual(36);
  });

  it("follows curved centerlines", () => {
    // A quarter-turn road: the far end should drift to one side of the screen.
    const curve: Vec2[] = [];
    for (let i = 0; i <= 20; i++) {
      const angle = (i / 20) * (Math.PI / 2);
      curve.push({ x: 30 * Math.sin(angle), y: 30 * (1 - Math.cos(angle)) });
    }
    const poly = projectRoadPolygon(curve, 6, cameraPos, 0, DEFAULT_CAMERA_CONFIG);
    expect(poly).not.toBeNull();
    const far = atExtreme(poly!.points, (p) => p.sy, "min");
    // Curving to the right (+Y world = +X camera at heading 0): far edge
    // center shifts right of NDC 0.
    expect(far.reduce((sum, p) => sum + p.sx, 0) / far.length).toBeGreaterThan(0);
  });
});
