import type { Vec2 } from "../../../world/model/types.ts";
import { projectNdc, DEFAULT_CAMERA_CONFIG, type CameraConfig } from "./camera3d.ts";

/** Input building geometry for projection. */
export interface BuildingInput {
  /** Building footprint vertices (world coordinates). */
  readonly footprint: readonly Vec2[];
  /** Building height in meters. */
  readonly heightMeters: number;
  /** Whether this is a historic landmark. */
  readonly isHistoric: boolean;
}

/** A point in normalized device coordinates. */
export interface NdcPoint {
  readonly sx: number;
  readonly sy: number;
}

/** A building projected as a 3D box (visible walls + roof). */
export interface ProjectedBuildingBox {
  /** Visible wall quads (4 vertices each), NDC coordinates. */
  readonly walls: readonly NdcPoint[][];
  /** Roof polygon vertices, NDC coordinates. */
  readonly roof: readonly NdcPoint[];
  /** Wall fill color. */
  readonly color: number;
  /** Roof fill color. */
  readonly roofColor: number;
  /** Nearest corner depth in meters (smaller = closer, painter ordering). */
  readonly depth: number;
}

/** Maximum forward distance at which buildings are projected. */
export const MAX_FORWARD_DIST = 120;
/** Maximum lateral distance at which buildings are projected. */
export const MAX_LATERAL_DIST = 45;
/** Maximum building height for projection (meters). */
export const MAX_PROJECTED_HEIGHT = 25;
/** Normal building color. */
export const BUILDING_COLOR = 0x806c61;
/** Historic building color. */
export const HISTORIC_COLOR = 0xa86f5d;
const NDC_CLAMP = 16;

function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

const clampNdc = (value: number): number => Math.max(-NDC_CLAMP, Math.min(NDC_CLAMP, value));

/**
 * Project nearby buildings into perspective boxes.
 *
 * Each footprint is projected corner-by-corner at ground level and at the
 * building height; only walls whose outward normal faces the camera are
 * drawn, then the roof on top. Buildings with any corner inside the near
 * clip zone are skipped (no 3D near-plane clipping for boxes).
 */
export function projectBuildings(
  buildings: readonly BuildingInput[],
  cameraPos: Vec2,
  cameraHeading: number,
  cameraConfig: CameraConfig = DEFAULT_CAMERA_CONFIG,
): ProjectedBuildingBox[] {
  const cosH = Math.cos(cameraHeading);
  const sinH = Math.sin(cameraHeading);

  const projected: ProjectedBuildingBox[] = [];

  for (const building of buildings) {
    const footprint = building.footprint;
    if (footprint.length < 3) continue;

    // Transform footprint to camera-relative coordinates.
    const relative: { x: number; z: number }[] = [];
    let totalZ = 0;
    for (const pt of footprint) {
      const dx = pt.x - cameraPos.x;
      const dy = pt.y - cameraPos.y;
      // Vehicle convention: forward = (cos heading, sin heading).
      // +Z = forward, +X = right.
      relative.push({ x: -dx * sinH + dy * cosH, z: dx * cosH + dy * sinH });
      totalZ += dx * cosH + dy * sinH;
    }
    const count = relative.length;
    const avgZ = totalZ / count;

    // Skip if behind the camera or too far.
    if (avgZ <= 0 || avgZ > MAX_FORWARD_DIST) continue;

    let avgX = 0;
    for (const p of relative) avgX += p.x;
    if (Math.abs(avgX / count) > MAX_LATERAL_DIST) continue;

    // Skip boxes that dip into the near clip zone (no 3D clipping).
    let minZ = Infinity;
    for (const p of relative) minZ = Math.min(minZ, p.z);
    if (minZ <= cameraConfig.nearClip * 1.5) continue;

    const height = Math.min(MAX_PROJECTED_HEIGHT, Math.max(1, building.heightMeters));

    const bottom: NdcPoint[] = [];
    const top: NdcPoint[] = [];
    for (const p of relative) {
      const b = projectNdc(p.x, 0, p.z, cameraConfig);
      const t = projectNdc(p.x, height, p.z, cameraConfig);
      bottom.push({ sx: clampNdc(b.sx), sy: clampNdc(b.sy) });
      top.push({ sx: clampNdc(t.sx), sy: clampNdc(t.sy) });
    }

    // Determine footprint winding (signed area) so the outward normal is
    // correct regardless of input vertex order.
    let area = 0;
    for (let i = 0; i < count; i++) {
      const a = relative[i];
      const b = relative[(i + 1) % count];
      area += a.x * b.z - b.x * a.z;
    }
    // Outward = right of travel for a clockwise (in camera x/z, x right / z
    // forward) footprint; flip when the winding is counter-clockwise.
    const outward = area > 0 ? 1 : -1;

    const walls: NdcPoint[][] = [];
    for (let i = 0; i < count; i++) {
      const a = relative[i];
      const b = relative[(i + 1) % count];
      const ex = b.x - a.x;
      const ez = b.z - a.z;
      // Right-of-travel normal in the camera plane.
      const nx = outward * ez;
      const nz = outward * -ex;
      // Visible when the outward normal points toward the camera (z < 0).
      if (nz >= 0) continue;
      walls.push([bottom[i], bottom[(i + 1) % count], top[(i + 1) % count], top[i]]);
    }

    const color = building.isHistoric ? HISTORIC_COLOR : BUILDING_COLOR;
    projected.push({
      walls,
      roof: top,
      color,
      roofColor: shade(color, 0.82),
      depth: minZ,
    });
  }

  // Sort back-to-front for painter-fill.
  projected.sort((a, b) => b.depth - a.depth);

  return projected;
}
