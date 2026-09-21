import type { VisualProfile } from "../types.ts";

/**
 * The default profile is the current renderer baseline moved here verbatim
 * (GTA world palette, road classes, roof/facade palettes, type styles,
 * outline, sidewalk and marking colors). Introducing LVP must not change
 * how unrecognized places look, so every value is the former hardcoded
 * constant. `ground.base` doubles as the viewport background tone.
 */
export const defaultProfile: VisualProfile = {
  schemaVersion: 1,
  id: "default",
  label: "Default",
  revision: 1,
  ground: {
    base: 0x91a477,
    water: 0x5b86a6,
    land: {
      park: 0x6f9a4e, grass: 0x7f9d5c, forest: 0x4f7a3a, residential: 0x8a9a6a,
      commercial: 0x8f8f86, industrial: 0x8a8a84, pedestrian: 0x9a958a, parking: 0x7d7d78,
      sand: 0xd8c48a, bare: 0xa8895f, generic: 0x8b9d70, unknown: 0x8b9d70,
    },
  },
  roads: {
    base: { fill: 0x53515a, casing: 0x302e38 },
    classes: {
      motorway: { fill: 0x3a3840, casing: 0x242228 },
      trunk: { fill: 0x3a3840, casing: 0x242228 },
      primary: { fill: 0x45424b, casing: 0x2c2a31 },
      secondary: { fill: 0x514f58, casing: 0x302e38 },
      tertiary: { fill: 0x514f58, casing: 0x302e38 },
      residential: { fill: 0x56545d, casing: 0x33313a },
      service: { fill: 0x56545d, casing: 0x33313a },
    },
    sidewalk: { fill: 0x9a9a92, curb: 0x9a9a92 },
    markings: { fill: 0xffffff },
  },
  buildings: {
    roofPalette: [0xb18d77, 0xa86f5d, 0x9c8468, 0x8f7f8a, 0x9a7a5a, 0x7d7a86, 0xc2a074, 0x96714f],
    facadePalette: [0x806c61, 0x6f5d52, 0x756a63, 0x6a5f6b, 0x7a6a58, 0x64616c, 0x94795a, 0x7a5a42],
    typeStyles: {
      historic: { roof: 0xa86f5d, facade: 0x8a5f52 },
      religious: { roof: 0xb8a86e, facade: 0x94865c },
      civic: { roof: 0x93a0ad, facade: 0x6f7a86 },
      industrial: { roof: 0x8d8d94, facade: 0x6e6e74 },
      commercial: { roof: 0x9d9188, facade: 0x7d726a },
    },
    outline: 0x27232c,
    depth2d: {
      shadowColor: 0x000000,
      shadowAlpha: 0.16,
      edgeLight: 0xffffff,
      edgeDark: 0x27232c,
    },
  },
  identity: {
    roofFamily: "default-roofs",
    sidewalkFamily: "default-stone",
    vegetationFamily: "default-vegetation",
    streetFurnitureFamily: "default-urban",
  },
};
