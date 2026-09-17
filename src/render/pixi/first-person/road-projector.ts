import type { Vec2 } from "../../../world/model/types.ts";
import { projectGroundNdc, type CameraConfig } from "./camera3d.ts";

/**
 * Sample spacing for the road centerline, in meters. MVT centerlines are
 * generalized (vertices tens of meters apart); sub-dividing keeps curves and
 * the near field of the projected polygon continuous.
 */
const DENSIFY_STEP_METERS = 4;
/** NDC clamp for projected polygon vertices (far off-screen, GPU clips). */
const NDC_CLAMP = 16;

interface CameraPoint {
  readonly x: number;
  readonly z: number;
}

interface CenterlineSample {
  readonly world: Vec2;
  readonly dir: Vec2;
}

function densifyWorld(centerline: readonly Vec2[], stepMeters: number): CenterlineSample[] {
  const out: CenterlineSample[] = [];
  for (let i = 1; i < centerline.length; i++) {
    const a = centerline[i - 1];
    const b = centerline[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (!Number.isFinite(length) || length < 1e-6) continue;
    const dir = { x: dx / length, y: dy / length };
    const steps = Math.max(1, Math.ceil(length / stepMeters));
    const from = i === 1 ? 0 : 1;
    for (let s = from; s <= steps; s++) {
      const t = s / steps;
      out.push({ world: { x: a.x + dx * t, y: a.y + dy * t }, dir });
    }
  }
  return out;
}

/**
 * Sutherland-Hodgman clip of a 2D (x, z) polygon against the half-plane
 * selected by `inside`; `t` gives the parameter of the plane crossing on an
 * edge (a + (b - a) * t).
 */
function clipHalfPlane(points: readonly CameraPoint[], inside: (p: CameraPoint) => boolean, t: (a: CameraPoint, b: CameraPoint) => number): CameraPoint[] {
  const out: CameraPoint[] = [];
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
}

/**
 * Cheap visibility test for a road, computed from the raw centerline
 * vertices only (before densification). Densified samples are linear blends
 * of the raw vertices and edge points are perpendicular offsets of at most
 * halfWidthMeters, so the camera-space z range of the raw vertices padded by
 * halfWidthMeters bounds the z of every point the projected polygon could
 * contain: if that padded range misses [nearClip, farClip], the near/far
 * clipping below is guaranteed to produce nothing.
 */
export function roadMightBeVisible(
  centerline: readonly Vec2[],
  halfWidthMeters: number,
  cameraPos: Vec2,
  cameraHeading: number,
  cameraConfig: CameraConfig,
): boolean {
  if (centerline.length < 2) return false;
  const cosH = Math.cos(cameraHeading);
  const sinH = Math.sin(cameraHeading);
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const v of centerline) {
    const z = (v.x - cameraPos.x) * cosH + (v.y - cameraPos.y) * sinH;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return maxZ + halfWidthMeters >= cameraConfig.nearClip && minZ - halfWidthMeters <= cameraConfig.farClip;
}

/** A road projected as a fillable ground-plane polygon. */
export interface ProjectedRoadPolygon {
  /** Fill vertices in NDC (sx: -1..1, sy: 0=horizon, + below), clamped. */
  readonly points: readonly { readonly sx: number; readonly sy: number }[];
  /** Nearest camera-space depth of the polygon in meters (smaller = closer). */
  readonly depth: number;
}

/**
 * Project a road centerline into a ground-plane polygon for perspective fill.
 *
 * The centerline is sub-sampled, offset by half the road width along the
 * world-space perpendicular of each sample (so the road keeps its real width
 * regardless of the angle to the camera), then the resulting edge polygon is
 * clipped against the near and far planes and projected. Returns null when
 * nothing survives clipping (road fully behind the camera or beyond the far
 * clip).
 */
export function projectRoadPolygon(
  centerline: readonly Vec2[],
  widthMeters: number,
  cameraPos: Vec2,
  cameraHeading: number,
  cameraConfig: CameraConfig,
): ProjectedRoadPolygon | null {
  if (centerline.length < 2 || widthMeters <= 0) return null;

  const cosH = Math.cos(cameraHeading);
  const sinH = Math.sin(cameraHeading);
  const toCamera = (p: Vec2): CameraPoint => {
    const dx = p.x - cameraPos.x;
    const dy = p.y - cameraPos.y;
    // Vehicle convention: forward = (cos heading, sin heading).
    // Rotate world offset into camera frame: +Z = forward, +X = right.
    return { x: -dx * sinH + dy * cosH, z: dx * cosH + dy * sinH };
  };

  const halfWidth = widthMeters / 2;
  // Pre-cull before densification: a raw-vertex z bbox missing the visible
  // range (padded by half the road width) is guaranteed to yield nothing
  // after near/far clipping, so the road is skipped before the densified
  // sample allocations.
  if (!roadMightBeVisible(centerline, halfWidth, cameraPos, cameraHeading, cameraConfig)) return null;

  const sampled = densifyWorld(centerline, DENSIFY_STEP_METERS);
  if (sampled.length < 2) return null;

  const left: CameraPoint[] = [];
  const right: CameraPoint[] = [];
  for (const s of sampled) {
    const px = -s.dir.y;
    const py = s.dir.x;
    left.push(toCamera({ x: s.world.x + px * halfWidth, y: s.world.y + py * halfWidth }));
    right.push(toCamera({ x: s.world.x - px * halfWidth, y: s.world.y - py * halfWidth }));
  }

  let poly: CameraPoint[] = [...left, ...right.slice().reverse()];
  poly = clipHalfPlane(poly, (p) => p.z >= cameraConfig.nearClip, (a, b) => (cameraConfig.nearClip - a.z) / (b.z - a.z));
  if (poly.length < 3) return null;
  poly = clipHalfPlane(poly, (p) => p.z <= cameraConfig.farClip, (a, b) => (cameraConfig.farClip - a.z) / (b.z - a.z));
  if (poly.length < 3) return null;

  const clamp = (v: number): number => Math.max(-NDC_CLAMP, Math.min(NDC_CLAMP, v));
  const points = poly.map((p) => {
    const ndc = projectGroundNdc(p.x, p.z, cameraConfig);
    return { sx: clamp(ndc.sx), sy: clamp(ndc.sy) };
  });
  let depth = Infinity;
  for (const p of poly) depth = Math.min(depth, p.z);
  return { points, depth };
}
