import type { Bounds2D, Vec2 } from "../world/model/types.ts";

/** Discrete zoom scale: five steps, default at the center. Factors are experimental (ZOOM-05). */
export type ZoomLevel = 0 | 1 | 2 | 3 | 4;
export const ZOOM_STEPS = [0.7, 0.85, 1.0, 1.2, 1.45] as const;
export type LodTier = "near" | "medium" | "far";

export interface ScreenSize { readonly width: number; readonly height: number; }

const ZOOM_LEVELS: readonly ZoomLevel[] = [0, 1, 2, 3, 4];
const DEFAULT_ZOOM_LEVEL: ZoomLevel = 2;
const LOD_BY_ZOOM: readonly LodTier[] = ["far", "far", "medium", "near", "near"];

/** Non-finite input has no clampable order, so it falls back to the default level. */
export function clampZoom(level: number): ZoomLevel {
  if (!Number.isFinite(level)) return DEFAULT_ZOOM_LEVEL;
  return ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, Math.round(level)))];
}

export function zoomFactor(level: ZoomLevel): number { return ZOOM_STEPS[clampZoom(level)]; }

/** Placeholder mapping for LOD-01, which will replace it with the real profile. */
export function lodForZoom(level: ZoomLevel): LodTier { return LOD_BY_ZOOM[clampZoom(level)]; }

/** World-space box seen by a centered camera: 1 meter canonical -> scale pixels. */
export function cameraBounds(position: Vec2, screenSize: ScreenSize, scale: number): Bounds2D {
  if (!Number.isFinite(scale) || scale <= 0) throw new Error("camera scale must be a positive finite number");
  const halfWidth = screenSize.width / scale / 2;
  const halfHeight = screenSize.height / scale / 2;
  return {
    minX: position.x - halfWidth,
    maxX: position.x + halfWidth,
    minY: position.y - halfHeight,
    maxY: position.y + halfHeight,
  };
}
