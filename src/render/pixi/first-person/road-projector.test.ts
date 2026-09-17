import { describe, it, expect } from "vitest";
import { projectRoadPolygon, roadMightBeVisible } from "./road-projector.ts";
import { projectGroundNdc, DEFAULT_CAMERA_CONFIG } from "./camera3d.ts";
import type { Vec2 } from "../../../world/model/types.ts";

/**
 * Reference: the pre-cull algorithm (densify every centerline, offset, clip
 * near/far, project). Kept here to pin AC2: any road the pre-cull keeps must
 * project bit-identically to this reference, and any road it drops is one
 * that already returned null.
 */
function referenceProjectRoadPolygon(
  centerline: readonly Vec2[],
  widthMeters: number,
  cameraPos: Vec2,
  cameraHeading: number,
  cameraConfig: typeof DEFAULT_CAMERA_CONFIG,
): { points: { sx: number; sy: number }[]; depth: number } | null {
  if (centerline.length < 2 || widthMeters <= 0) return null;
  const cosH = Math.cos(cameraHeading);
  const sinH = Math.sin(cameraHeading);
  const toCamera = (p: Vec2): { x: number; z: number } => {
    const dx = p.x - cameraPos.x;
    const dy = p.y - cameraPos.y;
    return { x: -dx * sinH + dy * cosH, z: dx * cosH + dy * sinH };
  };
  const sampled: { world: Vec2; dir: Vec2 }[] = [];
  for (let i = 1; i < centerline.length; i++) {
    const a = centerline[i - 1];
    const b = centerline[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (!Number.isFinite(length) || length < 1e-6) continue;
    const dir = { x: dx / length, y: dy / length };
    const steps = Math.max(1, Math.ceil(length / 4));
    const from = i === 1 ? 0 : 1;
    for (let s = from; s <= steps; s++) {
      const t = s / steps;
      sampled.push({ world: { x: a.x + dx * t, y: a.y + dy * t }, dir });
    }
  }
  if (sampled.length < 2) return null;
  const halfWidth = widthMeters / 2;
  const left: { x: number; z: number }[] = [];
  const right: { x: number; z: number }[] = [];
  for (const s of sampled) {
    const px = -s.dir.y;
    const py = s.dir.x;
    left.push(toCamera({ x: s.world.x + px * halfWidth, y: s.world.y + py * halfWidth }));
    right.push(toCamera({ x: s.world.x - px * halfWidth, y: s.world.y - py * halfWidth }));
  }
  const clip = (points: readonly { x: number; z: number }[], inside: (p: { x: number; z: number }) => boolean, t: (a: { x: number; z: number }, b: { x: number; z: number }) => number): { x: number; z: number }[] => {
    const out: { x: number; z: number }[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const aIn = inside(a);
      const bIn = inside(b);
      if (bIn) {
        if (!aIn) out.push({ x: a.x + (b.x - a.x) * t(a, b), z: a.z + (b.z - a.z) * t(a, b) });
        out.push(b);
      } else if (aIn) {
        out.push({ x: a.x + (b.x - a.x) * t(a, b), z: a.z + (b.z - a.z) * t(a, b) });
      }
    }
    return out;
  };
  let poly: { x: number; z: number }[] = [...left, ...right.slice().reverse()];
  poly = clip(poly, (p) => p.z >= cameraConfig.nearClip, (a, b) => (cameraConfig.nearClip - a.z) / (b.z - a.z));
  if (poly.length < 3) return null;
  poly = clip(poly, (p) => p.z <= cameraConfig.farClip, (a, b) => (cameraConfig.farClip - a.z) / (b.z - a.z));
  if (poly.length < 3) return null;
  const clamp = (v: number): number => Math.max(-16, Math.min(16, v));
  const points = poly.map((p) => {
    const ndc = projectGroundNdc(p.x, p.z, cameraConfig);
    return { sx: clamp(ndc.sx), sy: clamp(ndc.sy) };
  });
  let depth = Infinity;
  for (const p of poly) depth = Math.min(depth, p.z);
  return { points, depth };
}

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

describe("road-projector (pre-cull before densification)", () => {
  const cameraPos: Vec2 = { x: 0, y: 0 };

  it("culls a segment entirely behind the camera without densifying it", () => {
    const behind: Vec2[] = [{ x: -50, y: 0 }, { x: -20, y: 0 }];
    expect(roadMightBeVisible(behind, 3, cameraPos, 0, DEFAULT_CAMERA_CONFIG)).toBe(false);
    expect(projectRoadPolygon(behind, 6, cameraPos, 0, DEFAULT_CAMERA_CONFIG)).toBeNull();
  });

  it("culls a road entirely beyond the far clip without densifying it", () => {
    const beyond: Vec2[] = [{ x: 200, y: 0 }, { x: 300, y: 0 }];
    expect(roadMightBeVisible(beyond, 3, cameraPos, 0, DEFAULT_CAMERA_CONFIG)).toBe(false);
  });

  it("culls a crossing road whose padded bbox still misses the frustum", () => {
    // A road running along Y at x = -3 with 2 m width: its curbs reach
    // z = -2 at most, short of the 0.5 m near clip.
    const crossing: Vec2[] = [{ x: -3, y: -20 }, { x: -3, y: 20 }];
    expect(roadMightBeVisible(crossing, 1, cameraPos, 0, DEFAULT_CAMERA_CONFIG)).toBe(false);
    expect(projectRoadPolygon(crossing, 2, cameraPos, 0, DEFAULT_CAMERA_CONFIG)).toBeNull();
    expect(referenceProjectRoadPolygon(crossing, 2, cameraPos, 0, DEFAULT_CAMERA_CONFIG)).toBeNull();
  });

  it("keeps a crossing road whose curb reaches into the visible range", () => {
    // The centerline sits 1 m behind the camera, but the 2 m curb offset
    // crosses the 0.5 m near clip: a thin sliver must survive.
    const crossing: Vec2[] = [{ x: -1, y: -20 }, { x: -1, y: 20 }];
    expect(roadMightBeVisible(crossing, 2, cameraPos, 0, DEFAULT_CAMERA_CONFIG)).toBe(true);
    expect(projectRoadPolygon(crossing, 4, cameraPos, 0, DEFAULT_CAMERA_CONFIG)).not.toBeNull();
  });

  it("reproduces the un-culled reference exactly for every kept road", () => {
    const curve: Vec2[] = [];
    for (let i = 0; i <= 20; i++) {
      const angle = (i / 20) * (Math.PI / 2);
      curve.push({ x: 30 * Math.sin(angle), y: 30 * (1 - Math.cos(angle)) });
    }
    const crossing: Vec2[] = [];
    for (let y = -60; y <= 60; y += 10) crossing.push({ x: 70, y });
    const cases: Array<{ centerline: Vec2[]; width: number; heading: number }> = [
      { centerline: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }, { x: 40, y: 0 }], width: 6, heading: 0 },
      { centerline: [{ x: -5, y: 0 }, { x: 50, y: 0 }], width: 6, heading: 0 },
      { centerline: [{ x: -2, y: 0 }, { x: 80, y: 0 }], width: 6, heading: 0 },
      { centerline: crossing, width: 7, heading: 0 },
      { centerline: [{ x: -1, y: -20 }, { x: -1, y: 20 }], width: 4, heading: 0 },
      { centerline: curve, width: 6, heading: 0 },
      { centerline: [{ x: 0, y: 0 }, { x: 0, y: 40 }], width: 6, heading: Math.PI / 2 },
    ];
    for (const c of cases) {
      expect(roadMightBeVisible(c.centerline, c.width / 2, cameraPos, c.heading, DEFAULT_CAMERA_CONFIG)).toBe(true);
      expect(projectRoadPolygon(c.centerline, c.width, cameraPos, c.heading, DEFAULT_CAMERA_CONFIG))
        .toEqual(referenceProjectRoadPolygon(c.centerline, c.width, cameraPos, c.heading, DEFAULT_CAMERA_CONFIG));
    }
  });
});
