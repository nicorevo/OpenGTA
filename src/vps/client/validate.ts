import type { VisualProfile } from "../../render/theme/types.ts";

const isInt = (value: unknown): value is number => Number.isInteger(value);
const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isColorArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.length > 0 && value.every(isInt);

/**
 * Strict runtime guard for VisualProfile-shaped data arriving from the VPS
 * service. The service is a boundary: its JSON is untrusted input, so every
 * field the renderer reads is checked before the profile is applied.
 */
export function isVisualProfile(value: unknown): value is VisualProfile {
  if (!isPlainObject(value)) return false;
  if (value.schemaVersion !== 1 || !isNonEmptyString(value.id) || typeof value.label !== "string" || !isInt(value.revision)) {
    return false;
  }
  const ground = value.ground;
  if (!isPlainObject(ground) || !isInt(ground.base) || !isInt(ground.water) || !isPlainObject(ground.land)) return false;
  const roads = value.roads;
  if (!isPlainObject(roads)) return false;
  const { base, classes, sidewalk, markings } = roads;
  if (!isPlainObject(base) || !isInt(base.fill) || !isInt(base.casing)) return false;
  if (!isPlainObject(classes)) return false;
  if (!isPlainObject(sidewalk) || !isInt(sidewalk.fill) || !isInt(sidewalk.curb)) return false;
  if (!isPlainObject(markings) || !isInt(markings.fill)) return false;
  const buildings = value.buildings;
  if (
    !isPlainObject(buildings) || !isColorArray(buildings.roofPalette) || !isColorArray(buildings.facadePalette) ||
    !isPlainObject(buildings.typeStyles) || !isInt(buildings.outline)
  ) {
    return false;
  }
  const depth = buildings.depth2d;
  if (!isPlainObject(depth) || !isInt(depth.shadowColor) || !isInt(depth.edgeLight) || !isInt(depth.edgeDark) || typeof depth.shadowAlpha !== "number") {
    return false;
  }
  const identity = value.identity;
  return (
    isPlainObject(identity) &&
    isNonEmptyString(identity.roofFamily) &&
    isNonEmptyString(identity.sidewalkFamily) &&
    isNonEmptyString(identity.vegetationFamily) &&
    isNonEmptyString(identity.streetFurnitureFamily)
  );
}

export interface ParsedVpsProfileResponse {
  readonly source: "generated" | "cache" | "lvp";
  readonly profile: VisualProfile;
}

/**
 * Parse the /v1/profile JSON body (spec 106). Returns undefined for any
 * malformed shape: the caller degrades to the LVP profile, never throws.
 */
export function parseVpsProfileResponse(value: unknown): ParsedVpsProfileResponse | undefined {
  if (!isPlainObject(value)) return undefined;
  if (value.source !== "generated" && value.source !== "cache" && value.source !== "lvp") return undefined;
  if (!isVisualProfile(value.profile)) return undefined;
  return { source: value.source, profile: value.profile };
}
