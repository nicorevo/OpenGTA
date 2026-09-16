import type { Vec2 } from "../../../world/model/types.ts";
import { projectPerspective, DEFAULT_CAMERA_CONFIG } from "./camera3d.ts";

/** Input building geometry for projection. */
export interface BuildingInput {
  /** Building footprint vertices (world coordinates). */
  readonly footprint: readonly Vec2[];
  /** Building height in meters. */
  readonly heightMeters: number;
  /** Whether this is a historic landmark. */
  readonly isHistoric: boolean;
}

/** A projected building face ready for rendering. */
export interface ProjectedBuilding {
  /** Screen points of the visible face: [bottom-left, bottom-right, top-right, top-left]. */
  readonly screenPoints: [number, number, number, number, number, number, number, number];
  /** Fill color (0x806c61 for normal, 0xa86f5d for historic). */
  readonly color: number;
  /** Average distance in Z from the camera. */
  readonly worldZ: number;
  /** Projected height (clamped to max 25m). */
  readonly projectedHeight: number;
}

/** Maximum visible lateral distance from camera centerline. */
const MAX_LATERAL_DIST = 30;
/** Maximum visible forward distance. */
const MAX_FORWARD_DIST = 100;
/** Maximum building height for projection (meters). */
const MAX_PROJECTED_HEIGHT = 25;
/** Normal building color. */
const BUILDING_COLOR = 0x806c61;
/** Historic building color. */
const HISTORIC_COLOR = 0xa86f5d;

/**
 * Project nearby buildings into perspective faces.
 *
 * Only buildings within MAX_LATERAL_DIST laterally and MAX_FORWARD_DIST
 * forward are returned. Heights are clamped to MAX_PROJECTED_HEIGHT.
 */
export function projectBuildings(
  buildings: readonly BuildingInput[],
  cameraPos: Vec2,
  cameraHeading: number,
): ProjectedBuilding[] {
  const cosH = Math.cos(cameraHeading);
  const sinH = Math.sin(cameraHeading);

  const projected: ProjectedBuilding[] = [];

  for (const building of buildings) {
    // Transform footprint to camera-relative coordinates (already in meters)
    let totalZ = 0;
    let count = 0;
    const relativePoints: { x: number; z: number }[] = [];

    for (const pt of building.footprint) {
      const dx = pt.x - cameraPos.x;
      const dy = pt.y - cameraPos.y;
      // Vehicle convention: forward = (cos heading, sin heading).
      // +Z = forward, +X = right.
      const rz = dx * cosH + dy * sinH;
      const rx = -dx * sinH + dy * cosH;
      relativePoints.push({ x: rx, z: rz });
      totalZ += rz;
      count++;
    }

    const avgZ = totalZ / count;

    // Skip if behind camera or too far
    if (avgZ <= 0 || avgZ > MAX_FORWARD_DIST) continue;

    // Skip if too far laterally
    let avgX = 0;
    for (const p of relativePoints) avgX += p.x;
    avgX /= relativePoints.length;
    if (Math.abs(avgX) > MAX_LATERAL_DIST) continue;

    // Clamp height
    const clampedHeight = Math.min(MAX_PROJECTED_HEIGHT, Math.max(1, building.heightMeters));

    // Project the four corners (use the centroid of footprint as building center)
    const centerIdx = Math.floor(relativePoints.length / 2);
    const cx = relativePoints[centerIdx].x;
    const cz = relativePoints[centerIdx].z;

    // Project bottom center and top center
    const bottomProj = projectPerspective(cx, 0, cz, DEFAULT_CAMERA_CONFIG);
    const topProj = projectPerspective(cx, clampedHeight, cz, DEFAULT_CAMERA_CONFIG);

    if (bottomProj.rejected && topProj.rejected) continue;

    // Normalize sy: sy is NEGATIVE for ground points, use absolute value
    const normalizedSy = (sy: number) => Math.abs(sy) / (1 + Math.abs(sy));
    const screenYBottom = bottomProj.rejected ? 0 : normalizedSy(bottomProj.sy);
    const screenYTop = topProj.rejected ? 0 : normalizedSy(topProj.sy);

    // Clamp sx to [-1, 1]
    const clampedSx = (sx: number) => Math.max(-1, Math.min(1, sx));

    const screenLeft = clampedSx(bottomProj.rejected ? 0 : bottomProj.sx - 0.1);
    const screenRight = clampedSx(bottomProj.rejected ? 0 : bottomProj.sx + 0.1);

    const color = building.isHistoric ? HISTORIC_COLOR : BUILDING_COLOR;

    projected.push({
      screenPoints: [
        screenLeft, screenYBottom,
        screenRight, screenYBottom,
        screenRight, screenYTop,
        screenLeft, screenYTop,
      ],
      color,
      worldZ: cz,
      projectedHeight: clampedHeight,
    });
  }

  // Sort back-to-front for painter-fill
  projected.sort((a, b) => b.worldZ - a.worldZ);

  return projected;
}
