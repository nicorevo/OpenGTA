import { mergeVisualProfile } from "../merge.ts";
import { defaultProfile } from "./default.ts";

/**
 * Athens over the default profile (VPS v1.1, art direction draft pending
 * the user visual gate): whitewashed cube buildings, light flat roofs with
 * red-tile accents, warm Aegean stone pavers, dry Mediterranean ground.
 */
export const athensProfile = mergeVisualProfile(defaultProfile, {
  id: "athens",
  label: "Athens",
  revision: 1,
  ground: {
    base: 0x9a9a6e,
    land: {
      park: 0x7f9d55, grass: 0x8fa05e, residential: 0x9c9a74,
      commercial: 0x96927e, pedestrian: 0xc4b898, generic: 0x9a9872, unknown: 0x9a9872,
    },
  },
  roads: {
    base: { fill: 0x5a5650, casing: 0x35312c },
    sidewalk: { fill: 0xc9c0ac, curb: 0xb8ae98 },
  },
  buildings: {
    roofPalette: [0xd0ccc0, 0xc8c4b8, 0xd8d4c8, 0x9c8a78, 0x9a6a52, 0xc4c0b4, 0xdcd8cc, 0xb09a86],
    facadePalette: [0xe8e4da, 0xe0dccf, 0xece8de, 0xd4cfc2, 0xe4e0d4, 0xcac4b6, 0xf0ece2, 0xc0b8a8],
    typeStyles: {
      historic: { roof: 0x9a6a52, facade: 0xdcd2bc },
      religious: { roof: 0xd8d4c8, facade: 0xece8dc },
      civic: { roof: 0x9aa39b, facade: 0xd8d2c4 },
      commercial: { roof: 0xcac6ba, facade: 0xe4e0d2 },
    },
    outline: 0x2f2c26,
  },
  identity: {
    roofFamily: "athens-flat-stone",
    sidewalkFamily: "athens-pavers",
    vegetationFamily: "athens-mediterranean",
    streetFurnitureFamily: "athens-urban",
  },
});
