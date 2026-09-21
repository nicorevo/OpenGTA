import { mergeVisualProfile } from "../merge.ts";
import { defaultProfile } from "./default.ts";

/**
 * Baseline artistic direction for Italy: warm olive ground, warmer asphalt,
 * sand/cream facades, terracotta roofs, warmer shadows. Calm values, no
 * national symbols — the identity comes from the palette.
 */
export const italyProfile = mergeVisualProfile(defaultProfile, {
  id: "italy",
  label: "Italy",
  revision: 1,
  ground: {
    base: 0x98a06e,
    water: 0x5d88a0,
    land: {
      park: 0x7a9a55, grass: 0x8a9d63, forest: 0x587d42, residential: 0x949a72,
      commercial: 0x94907f, industrial: 0x8f8c80, pedestrian: 0xa09888, parking: 0x83806f,
      sand: 0xdcc48e, bare: 0xb08f63, generic: 0x96a06e, unknown: 0x96a06e,
    },
  },
  roads: {
    base: { fill: 0x57544e, casing: 0x33302b },
    classes: {
      motorway: { fill: 0x3d3a35, casing: 0x262420 },
      trunk: { fill: 0x3d3a35, casing: 0x262420 },
      primary: { fill: 0x4a4740, casing: 0x302e29 },
      secondary: { fill: 0x56534b, casing: 0x33312b },
      tertiary: { fill: 0x56534b, casing: 0x33312b },
      residential: { fill: 0x5a5750, casing: 0x36342e },
      service: { fill: 0x5a5750, casing: 0x36342e },
    },
    sidewalk: { fill: 0xa39a8a, curb: 0xa39a8a },
  },
  buildings: {
    roofPalette: [0xb5714f, 0xc07f5a, 0xa86a48, 0xb98a5e, 0x9e6a4a, 0x8f7f6a, 0xc4906a, 0x96603f],
    facadePalette: [0xcfc0a0, 0xc7b48f, 0xd6c9a8, 0xbfa985, 0xcabfa0, 0xb8a488, 0xd0c29c, 0xa89272],
    typeStyles: {
      historic: { roof: 0xb5714f, facade: 0xc9b184 },
      religious: { roof: 0xc9a86e, facade: 0xc4b489 },
      civic: { roof: 0x99a09c, facade: 0x7c8480 },
      industrial: { roof: 0x93908a, facade: 0x75736d },
      commercial: { roof: 0xa2988c, facade: 0x857c70 },
    },
    outline: 0x2b2620,
    depth2d: {
      shadowColor: 0x1a140c,
      shadowAlpha: 0.18,
      edgeLight: 0xfff4e0,
      edgeDark: 0x2b2620,
    },
  },
  identity: {
    roofFamily: "italy-tile",
    sidewalkFamily: "italy-stone",
    vegetationFamily: "italy-mediterranean",
    streetFurnitureFamily: "italy-urban",
  },
});
