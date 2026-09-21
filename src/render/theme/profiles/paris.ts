import { mergeVisualProfile } from "../merge.ts";
import { franceProfile } from "./france.ts";

/**
 * Paris over France: zinc-dominant roofs, limestone/cream/light-beige
 * facades, light cool stone sidewalks.
 */
export const parisProfile = mergeVisualProfile(franceProfile, {
  id: "paris",
  label: "Paris",
  revision: 1,
  ground: {
    base: 0x8e9c8a,
    land: {
      residential: 0x92988a, generic: 0x909c8a, unknown: 0x909c8a,
    },
  },
  roads: {
    base: { fill: 0x4e4e57, casing: 0x2d2d35 },
  },
  // Same refinement as France, cooler and more Parisian: zinc roofs with a
  // wider dark→light spread, limestone/cream facades with taupe entries for
  // tonal variety without added saturation.
  buildings: {
    roofPalette: [0x4e5864, 0x65707d, 0x747f8c, 0x858e98, 0x565f6b, 0x8e969e, 0x6a7480, 0x454e59],
    facadePalette: [0xe4dcc8, 0xd9d0ba, 0xccc1a8, 0xb5a992, 0xd5cfc0, 0xc2b9a5, 0xe8e0cc, 0xa89d88],
    typeStyles: {
      historic: { roof: 0x65707d, facade: 0xdcd2ba },
      religious: { roof: 0x747f8c, facade: 0xe4dcc8 },
      civic: { roof: 0x6a7480, facade: 0x98a2ae },
      commercial: { roof: 0x8a8578, facade: 0x847e76 },
    },
    outline: 0x24222b,
  },
  identity: {
    roofFamily: "paris-zinc-slate",
    sidewalkFamily: "paris-stone",
    vegetationFamily: "paris-temperate",
    streetFurnitureFamily: "paris-urban",
  },
});
