import { mergeVisualProfile } from "../merge.ts";
import { italyProfile } from "./italy.ts";

/**
 * Rome over Italy: sandier ground, travertine sidewalks, stronger terracotta
 * roofs and warmer ocher/beige/cream facades.
 */
export const romeProfile = mergeVisualProfile(italyProfile, {
  id: "rome",
  label: "Rome",
  revision: 1,
  ground: {
    base: 0x9d9a72,
    land: {
      residential: 0x9a9878, sand: 0xe0c892, generic: 0x9c9a72, unknown: 0x9c9a72,
    },
  },
  roads: {
    base: { fill: 0x5a564d, casing: 0x35312a },
  },
  buildings: {
    roofPalette: [0xb06a45, 0xbc7a52, 0xa55f3d, 0xc58a5e, 0x9c6240, 0xb98a63, 0x8f8578, 0xa05836],
    facadePalette: [0xd6c49e, 0xcdb88c, 0xd9c9a4, 0xc2a97f, 0xcfb992, 0xbda47c, 0xd2c09a, 0xb09468],
    typeStyles: {
      historic: { roof: 0xb56a42, facade: 0xcdb07f },
      religious: { roof: 0xcfa566, facade: 0xc9b585 },
      civic: { roof: 0x9aa39b, facade: 0x838b82 },
      commercial: { roof: 0xa59a8d, facade: 0x8a7f71 },
    },
    outline: 0x2d2820,
  },
  identity: {
    roofFamily: "rome-warm-roofs",
    sidewalkFamily: "rome-stone",
    vegetationFamily: "rome-mediterranean",
    streetFurnitureFamily: "rome-urban",
  },
});
