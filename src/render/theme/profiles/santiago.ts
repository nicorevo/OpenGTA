import { mergeVisualProfile } from "../merge.ts";
import { defaultProfile } from "./default.ts";

/**
 * Santiago over the default profile (VPS v1.1, art direction draft pending
 * the user visual gate): bright cream/concrete facades, dark flat roofs with
 * red-tile accents in the old center, cool concrete roads, dry Andean ground.
 */
export const santiagoProfile = mergeVisualProfile(defaultProfile, {
  id: "santiago",
  label: "Santiago",
  revision: 1,
  ground: {
    base: 0x97a06e,
    land: {
      park: 0x7d9a55, grass: 0x8aa060, residential: 0x94947c,
      commercial: 0x8f8f88, sand: 0xd8c48a, generic: 0x929478, unknown: 0x929478,
    },
  },
  roads: {
    base: { fill: 0x56545c, casing: 0x32303a },
    sidewalk: { fill: 0xa0a09a, curb: 0xa0a09a },
  },
  buildings: {
    roofPalette: [0x4a4a52, 0x55555e, 0x3f3f47, 0x62626c, 0x8a5a48, 0x4a4a52, 0x5a5a64, 0x7d7d88],
    facadePalette: [0xd8d4c8, 0xcfcabf, 0xd2ccc0, 0xbfb8a8, 0xc8c0b2, 0xb8b0a2, 0xddd8cc, 0xa89f92],
    typeStyles: {
      historic: { roof: 0x9c5a42, facade: 0xd0c4a8 },
      religious: { roof: 0x8a6a52, facade: 0xc4b898 },
      civic: { roof: 0x6a6a72, facade: 0xb8b2a4 },
      commercial: { roof: 0x585862, facade: 0xcac4b6 },
    },
    outline: 0x2a2830,
  },
  identity: {
    roofFamily: "santiago-flat-concrete",
    sidewalkFamily: "santiago-concrete",
    vegetationFamily: "santiago-continental",
    streetFurnitureFamily: "santiago-urban",
  },
});
