import { lodForZoom, type LodTier, type ZoomLevel } from "../app/camera.ts";

/** How much road presentation a tier keeps: FAR body only, MEDIUM plus casing, NEAR plus markings. */
export type RoadDetailLevel = "body" | "casing" | "marking";

/**
 * Presentation-only parameters of one LOD tier. Values stay parameters, never
 * scattered logic: labels, facades, road detail and culling read them instead of
 * hard-coding thresholds. The canonical world and the physics never see this
 * contract, and no tier value alters featureId, geometry or collisions.
 */
export interface LodPresentationProfile {
  /** Multiplier of the fake-2.5D facade height: 0 hides the extrusion, 1 is the full baseline. */
  readonly facadeStrength: number;
  /** Most detailed road stage drawn at the tier. */
  readonly roadDetail: RoadDetailLevel;
  /** Lowest label priority drawn at the tier; 0 keeps every label. */
  readonly labelMinPriority: number;
  /** Visual-only culling threshold in square pixels at the current view scale; 0 disables culling. */
  readonly cullMinAreaPx2: number;
}

/** Tier order from the farthest to the closest camera. */
export const LOD_TIERS: readonly LodTier[] = ["far", "medium", "near"];

/**
 * Initial experimental parameters from `docs/architecture/zoom-and-lod.md` and
 * `docs/architecture/2d-rendering-model.md` sections 26-27.
 *
 * - facadeStrength: the design ladder [0, 0.25, 0.6, 0.85, 1] collapsed on the
 *   representative levels 0, 2 and 4, matching F-LOD-2 (FAR facade ~0, NEAR full);
 * - roadDetail: FAR body, MEDIUM casing, NEAR marking;
 * - labelMinPriority: thresholds on the compiler priority scale (10..110), so FAR
 *   keeps only major places (105/110) and motorways (100), MEDIUM keeps tertiary
 *   roads (75) and above, NEAR keeps all labels;
 * - cullMinAreaPx2: screen footprint below the threshold is skipped visually only,
 *   and grows with the zoom out. Experimental, benchmarked by ZOOM-05 / CITY-02.
 */
export const LOD_PROFILES: Readonly<Record<LodTier, LodPresentationProfile>> = Object.freeze({
  far: Object.freeze({ facadeStrength: 0, roadDetail: "body", labelMinPriority: 100, cullMinAreaPx2: 64 }),
  medium: Object.freeze({ facadeStrength: 0.6, roadDetail: "casing", labelMinPriority: 75, cullMinAreaPx2: 16 }),
  near: Object.freeze({ facadeStrength: 1, roadDetail: "marking", labelMinPriority: 0, cullMinAreaPx2: 0 }),
});

/** Shared frozen instance per tier: consumers compare or pass it without copying. */
export function lodProfileForTier(tier: LodTier): LodPresentationProfile { return LOD_PROFILES[tier]; }

/** Single resolution path: the level is clamped and mapped by `lodForZoom`, never by a second table. */
export function lodProfileForZoom(level: ZoomLevel): LodPresentationProfile { return lodProfileForTier(lodForZoom(level)); }
