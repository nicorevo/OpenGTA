import { mergeVisualProfile } from "../merge.ts";
import { defaultProfile } from "./default.ts";

/**
 * Baseline artistic direction for France: cool green-gray ground, cool gray
 * asphalt, limestone/cream/taupe facades, zinc and slate roofs, softer
 * cooler shadows.
 */
export const franceProfile = mergeVisualProfile(defaultProfile, {
  id: "france",
  label: "France",
  revision: 1,
  ground: {
    base: 0x8b9a82,
    water: 0x5a86a8,
    land: {
      park: 0x6b9a58, grass: 0x7c9c66, forest: 0x4d7a44, residential: 0x8e9482,
      commercial: 0x8e8e88, industrial: 0x88888a, pedestrian: 0x98948e, parking: 0x7b7b7e,
      sand: 0xd2c290, bare: 0xa48d68, generic: 0x8e9c84, unknown: 0x8e9c84,
    },
  },
  roads: {
    base: { fill: 0x4f4f58, casing: 0x2e2e36 },
    classes: {
      motorway: { fill: 0x383840, casing: 0x222228 },
      trunk: { fill: 0x383840, casing: 0x222228 },
      primary: { fill: 0x42424b, casing: 0x2a2a32 },
      secondary: { fill: 0x4e4e57, casing: 0x2e2e37 },
      tertiary: { fill: 0x4e4e57, casing: 0x2e2e37 },
      residential: { fill: 0x53535c, casing: 0x31313a },
      service: { fill: 0x53535c, casing: 0x31313a },
    },
    sidewalk: { fill: 0x98989a, curb: 0x98989a },
  },
  // Refined per the user visual gate (LVP-VALIDATION-RESULT): the first cut
  // read as a neutral cartographic map, so the roofs spread from dark slate to
  // light weathered zinc (cool AND warm entries) and the facades mix cream,
  // limestone and taupe with more tonal range — still desaturated.
  buildings: {
    roofPalette: [0x55606c, 0x6b7682, 0x7d8792, 0x8d949c, 0x5d5a52, 0x8a8578, 0x4f5a66, 0x9aa0a6],
    facadePalette: [0xe0d4bc, 0xd8ccb4, 0xcfc2a8, 0xb8a894, 0xcac4b8, 0xd9c9b0, 0xa89c8c, 0xd4d0c4],
    typeStyles: {
      historic: { roof: 0x6b7682, facade: 0xd8ccb4 },
      religious: { roof: 0x7d8792, facade: 0xe0d4bc },
      civic: { roof: 0x6f7a86, facade: 0x98a2ac },
      industrial: { roof: 0x7d7d84, facade: 0x6c6c74 },
      commercial: { roof: 0x8a8578, facade: 0x8f887c },
    },
    outline: 0x25232c,
    depth2d: {
      shadowColor: 0x0a0e14,
      shadowAlpha: 0.14,
      edgeLight: 0xe8f0f8,
      edgeDark: 0x25232c,
    },
  },
  identity: {
    roofFamily: "france-slate",
    sidewalkFamily: "france-stone",
    vegetationFamily: "france-temperate",
    streetFurnitureFamily: "france-urban",
  },
});
