import type { BuildingTypeVisualStyle, RoadVisualStyle, ThemeColor, VisualProfile } from "./types.ts";

export type { ThemeColor, VisualProfile } from "./types.ts";
export type { BuildingTypeVisualStyle, RoadVisualStyle } from "./types.ts";
export type { VisualProfilePatch } from "./merge.ts";
export { mergeVisualProfile } from "./merge.ts";
export { stableStringHash } from "./hash.ts";
export { themeOverrideFromSearch } from "./override.ts";
export { createVisualProfileResolver, knownThemeIds, normalizeLocationToken, themeIdOfProfile, THEME_BY_ID } from "./resolver.ts";
export type { ThemeMatchedBy, ThemeResolution, VisualProfileResolver } from "./resolver.ts";
export { defaultProfile } from "./profiles/default.ts";
export { italyProfile } from "./profiles/italy.ts";
export { romeProfile } from "./profiles/rome.ts";
export { franceProfile } from "./profiles/france.ts";
export { parisProfile } from "./profiles/paris.ts";
export { tokyoProfile } from "./profiles/tokyo.ts";
export { santiagoProfile } from "./profiles/santiago.ts";
export { athensProfile } from "./profiles/athens.ts";

export interface BuildingStyle {
  readonly roof: ThemeColor;
  readonly facade: ThemeColor;
}

/** Water first, then the land class, then the base tone: one place to ask. */
export function groundFill(profile: VisualProfile, kind: "water" | "land", cls: string): ThemeColor {
  if (kind === "water") return profile.ground.water;
  return profile.ground.land[cls] ?? profile.ground.base;
}

/** Compiled road class with the base asphalt as fallback. */
export function roadStyle(profile: VisualProfile, cls: string): RoadVisualStyle {
  return profile.roads.classes[cls] ?? profile.roads.base;
}

/**
 * Typed building classes pin their style; generic classes pick a palette
 * entry by seed: seed % palette.length, never Math.random().
 */
export function buildingStyle(profile: VisualProfile, cls: string, seed: number): BuildingStyle {
  const typed: BuildingTypeVisualStyle | undefined = profile.buildings.typeStyles[cls];
  if (typed) return { roof: typed.roof, facade: typed.facade };
  const roofPalette = profile.buildings.roofPalette;
  const facadePalette = profile.buildings.facadePalette;
  const i = Math.abs(seed) % roofPalette.length;
  const j = Math.abs(seed) % facadePalette.length;
  return { roof: roofPalette[i], facade: facadePalette[j] };
}
