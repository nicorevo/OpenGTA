import type { BuildingTypeVisualStyle, RoadVisualStyle, ThemeColor, VisualProfile } from "./types.ts";

/**
 * A patch derives one profile from another (e.g. rome from italy) without
 * restating the whole contract. Only the visual differences are listed.
 */
export interface VisualProfilePatch {
  readonly id: string;
  readonly label: string;
  readonly revision?: number;

  readonly ground?: {
    readonly base?: ThemeColor;
    readonly water?: ThemeColor;
    readonly land?: Readonly<Record<string, ThemeColor>>;
  };

  readonly roads?: {
    readonly base?: Partial<RoadVisualStyle>;
    readonly classes?: Readonly<Record<string, Partial<RoadVisualStyle>>>;
    readonly sidewalk?: {
      readonly fill?: ThemeColor;
      readonly curb?: ThemeColor;
    };
    readonly markings?: {
      readonly fill?: ThemeColor;
    };
  };

  readonly buildings?: {
    readonly roofPalette?: readonly ThemeColor[];
    readonly facadePalette?: readonly ThemeColor[];
    readonly typeStyles?: Readonly<Record<string, Partial<BuildingTypeVisualStyle>>>;
    readonly outline?: ThemeColor;
    readonly depth2d?: Partial<VisualProfile["buildings"]["depth2d"]>;
  };

  readonly identity?: Partial<VisualProfile["identity"]>;
}

function mergedRoadClass(parent: RoadVisualStyle | undefined, patch: Partial<RoadVisualStyle>, key: string): RoadVisualStyle {
  const fill = patch.fill ?? parent?.fill;
  const casing = patch.casing ?? parent?.casing;
  if (fill === undefined || casing === undefined) {
    throw new Error(`VisualProfilePatch: road class "${key}" is incomplete (a new class needs both fill and casing)`);
  }
  return { fill, casing };
}

function mergedBuildingType(parent: BuildingTypeVisualStyle | undefined, patch: Partial<BuildingTypeVisualStyle>, key: string): BuildingTypeVisualStyle {
  const roof = patch.roof ?? parent?.roof;
  const facade = patch.facade ?? parent?.facade;
  if (roof === undefined || facade === undefined) {
    throw new Error(`VisualProfilePatch: building type "${key}" is incomplete (a new type needs both roof and facade)`);
  }
  return { roof, facade };
}

function replacePalette(name: string, parent: readonly ThemeColor[], patch: readonly ThemeColor[] | undefined): readonly ThemeColor[] {
  if (patch === undefined) return parent;
  if (patch.length === 0) throw new Error(`VisualProfilePatch: ${name} must not be empty`);
  return [...patch];
}

/**
 * Explicit, typed merge of a patch onto a parent profile.
 *
 * - returns a new object; the parent is never mutated;
 * - maps are merged per key, nested values per field;
 * - palettes are replaced wholesale (never concatenated);
 * - brand-new road classes / building types must be complete;
 * - empty palettes are rejected: a resolved profile is always complete.
 *
 * No external deep-merge library by design.
 */
export function mergeVisualProfile(parent: VisualProfile, patch: VisualProfilePatch): VisualProfile {
  const roadClasses: Record<string, RoadVisualStyle> = { ...parent.roads.classes };
  for (const [key, entry] of Object.entries(patch.roads?.classes ?? {})) {
    roadClasses[key] = mergedRoadClass(parent.roads.classes[key], entry, key);
  }
  const typeStyles: Record<string, BuildingTypeVisualStyle> = { ...parent.buildings.typeStyles };
  for (const [key, entry] of Object.entries(patch.buildings?.typeStyles ?? {})) {
    typeStyles[key] = mergedBuildingType(parent.buildings.typeStyles[key], entry, key);
  }
  return {
    schemaVersion: 1,
    id: patch.id,
    label: patch.label,
    revision: patch.revision ?? parent.revision,
    ground: {
      base: patch.ground?.base ?? parent.ground.base,
      water: patch.ground?.water ?? parent.ground.water,
      land: { ...parent.ground.land, ...patch.ground?.land },
    },
    roads: {
      base: { ...parent.roads.base, ...patch.roads?.base },
      classes: roadClasses,
      sidewalk: {
        fill: patch.roads?.sidewalk?.fill ?? parent.roads.sidewalk.fill,
        curb: patch.roads?.sidewalk?.curb ?? parent.roads.sidewalk.curb,
      },
      markings: {
        fill: patch.roads?.markings?.fill ?? parent.roads.markings.fill,
      },
    },
    buildings: {
      roofPalette: replacePalette("buildings.roofPalette", parent.buildings.roofPalette, patch.buildings?.roofPalette),
      facadePalette: replacePalette("buildings.facadePalette", parent.buildings.facadePalette, patch.buildings?.facadePalette),
      typeStyles,
      outline: patch.buildings?.outline ?? parent.buildings.outline,
      depth2d: { ...parent.buildings.depth2d, ...patch.buildings?.depth2d },
    },
    identity: { ...parent.identity, ...patch.identity },
  };
}
