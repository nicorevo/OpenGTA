import type { Bounds2D, Vec2 } from "../world/model/types.ts";

/**
 * Discrete zoom scale: six steps. G2D-01 recalibrated the driving preset:
 * level 3 = 6.0 (8 px/m at 640x480, taxi ~40x17 px, 6 m road ~48 px) while
 * levels 4-5 are the separate maximum/close-view targets (16 and 32 px/m at
 * 640x480), not multipliers of the driving preset. Levels 0-1 keep the far
 * overview; level 2 = 2.25 is the intermediate district view between the
 * overview and the driving preset (ZI: the 7x overview->driving jump is
 * split into two even ~2.6x steps, every step stays under 3x).
 */
export type ZoomLevel = 0 | 1 | 2 | 3 | 4 | 5;
export const ZOOM_STEPS = [0.7, 0.85, 2.25, 6.0, 12.0, 24.0] as const;
export type LodTier = "near" | "medium" | "far";

export interface ScreenSize { readonly width: number; readonly height: number; }

const ZOOM_LEVELS: readonly ZoomLevel[] = [0, 1, 2, 3, 4, 5];
export const DEFAULT_ZOOM_LEVEL: ZoomLevel = 3;
/** LOD-01 policy: tier range boundaries over the discrete levels (0-1 far, 2-3 medium, 4-5 near). */
const FAR_MAX_ZOOM_LEVEL: ZoomLevel = 1;
const MEDIUM_MAX_ZOOM_LEVEL: ZoomLevel = 3;

/** Non-finite input has no clampable order, so it falls back to the default level. */
export function clampZoom(level: number): ZoomLevel {
  if (!Number.isFinite(level)) return DEFAULT_ZOOM_LEVEL;
  return ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, Math.round(level)))];
}

export function zoomFactor(level: ZoomLevel): number { return ZOOM_STEPS[clampZoom(level)]; }

/**
 * Total and deterministic tier for every level: out-of-range input is clamped
 * before the mapping, so the 0..5 range always yields exactly one tier. The
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
