import type { VisualProfile } from "../../render/theme/types.ts";
import { defaultProfile, romeProfile, franceProfile, parisProfile, tokyoProfile } from "../../render/theme/profiles/index.ts";
import type { VisualCatalog } from "./types.ts";

function roadStylesFrom(profile: VisualProfile) {
  const classes: Record<string, { readonly fill: number; readonly casing: number }> = {};
  for (const [key, style] of Object.entries(profile.roads.classes)) {
    classes[key] = { fill: style.fill, casing: style.casing };
  }
  return {
    base: { fill: profile.roads.base.fill, casing: profile.roads.base.casing },
    classes,
  };
}

/**
 * The minimum viable catalog (spec 138), seeded by expanding the six
 * validated LVP profiles into families (ADR-015): every value already passed
 * the user visual gate, so generated profiles start inside the established
 * OpenGTA style. Art direction changes here trigger profile recompile, not
 * re-analysis (spec 56).
 */
export const defaultCatalog: VisualCatalog = {
  catalogRevision: 1,

  facadePalettes: [
    {
      id: "cream-stone",
      semanticTags: ["cream", "white", "sand"],
      colors: [...parisProfile.buildings.facadePalette],
    },
    {
      id: "warm-stone",
      semanticTags: ["ochre", "sand", "terracotta", "warm-grey", "brown"],
      colors: [...romeProfile.buildings.facadePalette],
    },
    {
      // cool-grey must dominate to select this palette; sharing white/cream
      // would beat cream-stone on Paris-like evidence.
      id: "cool-zinc",
      semanticTags: ["cool-grey"],
      colors: [...franceProfile.buildings.facadePalette],
    },
    {
      id: "concrete-steel",
      semanticTags: ["cool-grey", "dark", "mixed"],
      colors: [...tokyoProfile.buildings.facadePalette],
    },
  ],

  roofFamilies: [
    {
      id: "terracotta-urban",
      semanticTags: ["terracotta-tile", "red-tile"],
      variants: [...romeProfile.buildings.roofPalette],
    },
    {
      id: "zinc-city",
      semanticTags: ["zinc", "slate", "metal"],
      variants: [...parisProfile.buildings.roofPalette],
    },
    {
      id: "charcoal-steel",
      semanticTags: ["flat-concrete", "dark-tile", "metal"],
      variants: [...tokyoProfile.buildings.roofPalette],
    },
    {
      id: "flat-neutral",
      semanticTags: ["flat-concrete", "mixed", "green-roof"],
      variants: [...defaultProfile.buildings.roofPalette],
    },
  ],

  roadFamilies: [
    {
      id: "warm-asphalt",
      semanticTags: ["asphalt", "cobblestone"],
      ...roadStylesFrom(romeProfile),
    },
    {
      id: "neutral-asphalt",
      semanticTags: ["asphalt", "concrete", "gravel", "dirt"],
      ...roadStylesFrom(defaultProfile),
    },
    {
      id: "cool-asphalt",
      semanticTags: ["asphalt", "concrete", "pavers"],
      ...roadStylesFrom(tokyoProfile),
    },
  ],

  sidewalkFamilies: [
    { id: "warm-stone-v1", semanticTags: ["warm-stone"], fill: romeProfile.roads.sidewalk.fill, curb: romeProfile.roads.sidewalk.curb },
    { id: "light-stone-v1", semanticTags: ["light-stone", "dark-stone"], fill: parisProfile.roads.sidewalk.fill, curb: parisProfile.roads.sidewalk.curb },
    { id: "concrete-v1", semanticTags: ["concrete"], fill: tokyoProfile.roads.sidewalk.fill, curb: tokyoProfile.roads.sidewalk.curb },
    { id: "pavers-neutral-v1", semanticTags: ["pavers", "brick", "asphalt"], fill: defaultProfile.roads.sidewalk.fill, curb: defaultProfile.roads.sidewalk.curb },
  ],

  vegetationFamilies: [
    {
      id: "mediterranean",
      semanticTags: ["mediterranean-urban"],
      ground: {
        park: romeProfile.ground.land["park"] ?? romeProfile.ground.base,
        grass: romeProfile.ground.land["grass"] ?? romeProfile.ground.base,
        forest: romeProfile.ground.land["forest"] ?? romeProfile.ground.base,
      },
      densityHint: 0.35,
    },
    {
      id: "temperate",
      semanticTags: ["temperate-urban"],
      ground: {
        park: franceProfile.ground.land["park"] ?? franceProfile.ground.base,
        grass: franceProfile.ground.land["grass"] ?? franceProfile.ground.base,
        forest: franceProfile.ground.land["forest"] ?? franceProfile.ground.base,
      },
      densityHint: 0.45,
    },
    {
      id: "continental",
      semanticTags: ["continental-urban", "sparse", "arid-urban", "tropical-urban"],
      ground: {
        park: tokyoProfile.ground.land["park"] ?? tokyoProfile.ground.base,
        grass: tokyoProfile.ground.land["grass"] ?? tokyoProfile.ground.base,
        forest: tokyoProfile.ground.land["forest"] ?? tokyoProfile.ground.base,
      },
      densityHint: 0.25,
    },
  ],

  streetFurnitureFamilies: [
    { id: "classic-europe", semanticTags: ["classic-europe"] },
    { id: "modern-europe", semanticTags: ["modern-europe", "minimal"] },
    { id: "east-asian", semanticTags: ["east-asian"] },
  ],
};
