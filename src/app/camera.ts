import type { Bounds2D, Vec2 } from "../world/model/types.ts";

/**
 * Discrete zoom scale: five steps, default at the center. Factors are
 * experimental (ZOOM-05). Levels 0-2 keep the far/medium/default view; levels
 * 3-4 pull in to the GTA-1-like close view (~10x the default at max, close-zoom-v1).
 */
export type ZoomLevel = 0 | 1 | 2 | 3 | 4;
export const ZOOM_STEPS = [0.7, 0.85, 1.0, 4.0, 14.0] as const;
export type LodTier = "near" | "medium" | "far";

export interface ScreenSize { readonly width: number; readonly height: number; }

const ZOOM_LEVELS: readonly ZoomLevel[] = [0, 1, 2, 3, 4];
const DEFAULT_ZOOM_LEVEL: ZoomLevel = 2;
/** LOD-01 policy: tier range boundaries over the discrete levels (0-1 far, 2 medium, 3-4 near). */
const FAR_MAX_ZOOM_LEVEL: ZoomLevel = 1;
const MEDIUM_MAX_ZOOM_LEVEL: ZoomLevel = 2;

/** Non-finite input has no clampable order, so it falls back to the default level. */
export function clampZoom(level: number): ZoomLevel {
  if (!Number.isFinite(level)) return DEFAULT_ZOOM_LEVEL;
  return ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, Math.round(level)))];
}

export function zoomFactor(level: ZoomLevel): number { return ZOOM_STEPS[clampZoom(level)]; }

/**
 * Total and deterministic tier for every level: out-of-range input is clamped
 * before the mapping, so the 0..4 range always yields exactly one tier. The
 * boundaries are experimental and get recalibrated with the factors fixed by
 * ZOOM-05; the presentation parameters per tier live in `src/render/lod-profile.ts`,
 * which is keyed by the tiers returned here.
 */
export function lodForZoom(level: ZoomLevel): LodTier {
  const clamped = clampZoom(level);
  if (clamped <= FAR_MAX_ZOOM_LEVEL) return "far";
  if (clamped <= MEDIUM_MAX_ZOOM_LEVEL) return "medium";
  return "near";
}

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
