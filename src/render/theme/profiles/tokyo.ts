import { mergeVisualProfile } from "../merge.ts";
import { defaultProfile } from "./default.ts";

/**
 * Tokyo over Default (LVP-2, spec 56): the third visual family — cool
 * concrete, steel and charcoal. Deliberately darker and higher contrast than
 * the European profiles (warm Rome, pale Paris) so the system is proven not
 * to work only with a warm/cold European axis. Still fully desaturated:
 * charcoal/dark-slate roofs, mid concrete facades with a blue tint, deep
 * steel-blue water, darker cool asphalt.
 */
export const tokyoProfile = mergeVisualProfile(defaultProfile, {
  id: "tokyo",
  label: "Tokyo",
  revision: 1,
  ground: {
    base: 0x87918c,
    water: 0x48617e,
    land: {
      park: 0x5f8a52, grass: 0x6f9258, forest: 0x44683c, residential: 0x89908c,
      commercial: 0x8a8c8e, industrial: 0x84868a, pedestrian: 0x96969a, parking: 0x76787c,
      sand: 0xbdb6a4, bare: 0x9a8f7a, generic: 0x87918c, unknown: 0x87918c,
    },
  },
  roads: {
    base: { fill: 0x3c4046, casing: 0x23262b },
    classes: {
      motorway: { fill: 0x2c2f35, casing: 0x1c1e23 },
      trunk: { fill: 0x2c2f35, casing: 0x1c1e23 },
      primary: { fill: 0x34373e, casing: 0x212329 },
      secondary: { fill: 0x40444b, casing: 0x26282f },
      tertiary: { fill: 0x40444b, casing: 0x26282f },
      residential: { fill: 0x454951, casing: 0x2a2d33 },
      service: { fill: 0x454951, casing: 0x2a2d33 },
    },
    sidewalk: { fill: 0x92959a, curb: 0x92959a },
  },
  buildings: {
    roofPalette: [0x2f343c, 0x3a414b, 0x282d34, 0x464f5c, 0x525b68, 0x333a44, 0x5d6673, 0x22262c],
    facadePalette: [0xaab0b6, 0x9aa1a8, 0xbcc1c6, 0x8b939c, 0x93a3b3, 0xc6cbd1, 0x7c858f, 0xd3cfc4],
    typeStyles: {
      historic: { roof: 0x3a414b, facade: 0xc9c2b4 },
      religious: { roof: 0x464f5c, facade: 0xd6d2c6 },
      civic: { roof: 0x525b68, facade: 0x8fa5ba },
      industrial: { roof: 0x333a44, facade: 0x5d636b },
      commercial: { roof: 0x5d6673, facade: 0x8a7f96 },
    },
    outline: 0x1e2126,
    depth2d: {
      shadowColor: 0x0c1016,
      shadowAlpha: 0.2,
      edgeLight: 0xe6f0fa,
      edgeDark: 0x1e2126,
    },
  },
  identity: {
    roofFamily: "tokyo-charcoal-steel",
    sidewalkFamily: "tokyo-concrete",
    vegetationFamily: "tokyo-temperate",
    streetFurnitureFamily: "tokyo-urban",
  },
});
