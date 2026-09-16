import type { Vec2 } from "../../../world/model/types.ts";
import { projectPerspective, type CameraConfig, type ProjectedPoint } from "./camera3d.ts";

/**
 * Sample spacing for the pseudo-3D road strip, in meters. MVT centerlines
 * are generalized (vertices tens of meters apart); sub-dividing keeps the
 * road continuous from the bottom of the screen to the horizon.
 */
const DENSIFY_STEP_METERS = 4;

interface CameraPoint {
  readonly x: number;
  readonly z: number;
}

function densify(points: readonly CameraPoint[], stepMeters: number): CameraPoint[] {
  const out: CameraPoint[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const distance = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.max(1, Math.ceil(distance / stepMeters));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
  }
  return out;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/** A single projected road segment ready for rendering. */
export interface RoadSegment {
  /** Distance in meters along the camera's forward axis. */
  readonly worldZ: number;
  /** Screen X of the left edge in pixels. */
  readonly leftScreenX: number;
  /** Screen X of the right edge in pixels. */
  readonly rightScreenX: number;
  /** Screen width in pixels (right - left). */
  readonly screenWidth: number;
  /** Screen Y in pixels (horizon → top of screen). */
  readonly screenY: number;
  /** World X of the left edge. */
  readonly worldLeftX: number;
  /** World X of the right edge. */
  readonly worldRightX: number;
}

/**
 * Project a road centerline into perspective segments.
 *
 * Centerline coordinates are in local meters (tangent-projected from the origin).
 * The centerline points are transformed into camera-relative coordinates:
 * - worldZ: distance along the camera's forward axis
 * - worldX: distance lateral to the camera (positive = right)
 *
 * Segments are returned back-to-front (farthest first) for painter-fill
 * rendering. Points behind the camera or beyond the far clip are excluded.
 */
export function projectRoadSegments(
  centerline: readonly Vec2[],
  widthMeters: number,
  cameraPos: Vec2,
  cameraHeading: number,
  cameraConfig: CameraConfig,
): RoadSegment[] {
  if (centerline.length < 2) return [];

  const cosH = Math.cos(cameraHeading);
  const sinH = Math.sin(cameraHeading);

  // Centerline is already in local meters (tangent-projected from origin)
  // Transform centerline to camera-relative coordinates
  const relative: CameraPoint[] = [];
  for (const pt of centerline) {
    const dx = pt.x - cameraPos.x;
    const dy = pt.y - cameraPos.y;
    // Vehicle convention: forward = (cos heading, sin heading).
    // Rotate world offset into camera frame: +Z = forward, +X = right.
    const rz = dx * cosH + dy * sinH;
    const rx = -dx * sinH + dy * cosH;
    relative.push({ x: rx, z: rz });
  }

  const sampled = densify(relative, DENSIFY_STEP_METERS);

  // Build segments between consecutive points
  const rawSegments: { z: number; leftX: number; rightX: number; segIdx: number }[] = [];
  for (let i = 0; i < sampled.length - 1; i++) {
    const a = sampled[i];
    const b = sampled[i + 1];

    // Skip if both points are behind camera
    if (a.z <= 0 && b.z <= 0) continue;

    // Skip if both points are beyond far clip
    if (a.z >= cameraConfig.farClip && b.z >= cameraConfig.farClip) continue;

    const midZ = (a.z + b.z) / 2;
    const midX = (a.x + b.x) / 2;

    rawSegments.push({
      z: midZ,
      leftX: midX - widthMeters / 2,
      rightX: midX + widthMeters / 2,
      segIdx: i,
    });
  }

  // Sort back-to-front
  rawSegments.sort((a, b) => b.z - a.z);

  // Project to screen coordinates
  const segments: RoadSegment[] = [];
  for (const raw of rawSegments) {
    // Left edge
    const leftProj = projectPerspective(raw.leftX, 0, raw.z, cameraConfig);
    const rightProj = projectPerspective(raw.rightX, 0, raw.z, cameraConfig);

    if (leftProj.rejected && rightProj.rejected) continue;

    const screenZ = raw.z;
    const leftSx = leftProj.sx;
    const rightSx = rightProj.sx;

    // sy from perspective: 0 at camera horizon line, positive below horizon
    // for ground points. Map |sy| → [0,1]: |sy|→∞ (close) → 1 (bottom),
    // |sy|→0 (far) → 0 (horizon).
    const avgSy = Math.abs((leftProj.sy + rightProj.sy) / 2);
    const normalizedSy = avgSy / (1 + avgSy);
    const screenY = Math.max(0, Math.min(1, normalizedSy));

    // Symmetric clamping keeps leftScreenX <= rightScreenX even when the
    // road leaves the screen on one side.
    const leftScreenX = clamp01((leftSx + 1) / 2);
    const rightScreenX = clamp01((rightSx + 1) / 2);

    segments.push({
      worldZ: screenZ,
      leftScreenX,
      rightScreenX,
      screenWidth: Math.max(0.01, rightScreenX - leftScreenX),
      screenY,
      worldLeftX: raw.leftX,
      worldRightX: raw.rightX,
    });
  }

  return segments;
}
