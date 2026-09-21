import { describe, expect, it } from "vitest";
import { stableStringHash } from "./hash.ts";
import { mergeVisualProfile } from "./merge.ts";
import { defaultProfile } from "./profiles/default.ts";
import type { VisualProfile } from "./types.ts";

const parent: VisualProfile = {
  schemaVersion: 1,
  id: "default",
  label: "Default",
  revision: 1,
  ground: { base: 0x111111, water: 0x222222, land: { park: 0x333333, sand: 0x444444 } },
  roads: {
    base: { fill: 0x555555, casing: 0x666666 },
    classes: { primary: { fill: 0x777777, casing: 0x888888 } },
    sidewalk: { fill: 0x999999, curb: 0xaaaaaaaa },
    markings: { fill: 0xbbbbbbbb },
  },
  buildings: {
    roofPalette: [0xcccccccc, 0xdddddddd],
    facadePalette: [0xeeeeeeee, 0xffffffff],
    typeStyles: { historic: { roof: 0x101010, facade: 0x202020 } },
    outline: 0x303030,
    depth2d: { shadowColor: 0x404040, shadowAlpha: 0.5, edgeLight: 0x505050, edgeDark: 0x606060 },
  },
  identity: { roofFamily: "f-roof", sidewalkFamily: "f-sidewalk", vegetationFamily: "f-veg", streetFurnitureFamily: "f-furn" },
};

describe("mergeVisualProfile", () => {
  it("returns a new object and does not mutate the parent", () => {
    const merged = mergeVisualProfile(parent, { id: "child", label: "Child" });
    expect(merged).not.toBe(parent);
    expect(merged.id).toBe("child");
    expect(merged.label).toBe("Child");
    expect(parent.id).toBe("default");
    expect(parent.ground.land).toEqual({ park: 0x333333, sand: 0x444444 });
    expect(parent.roads.classes.primary.fill).toBe(0x777777);
    expect(merged.ground).not.toBe(parent.ground);
    expect(merged.ground.land).not.toBe(parent.ground.land);
  });

  it("applies the patch id/label and keeps the parent revision unless overridden", () => {
    expect(mergeVisualProfile(parent, { id: "child", label: "Child" }).revision).toBe(1);
    expect(mergeVisualProfile(parent, { id: "child", label: "Child", revision: 2 }).revision).toBe(2);
  });

  it("merges the land map by key, preserving untouched keys", () => {
    const merged = mergeVisualProfile(parent, { id: "c", label: "C", ground: { land: { park: 0x555555, lake: 0x666666 } } });
    expect(merged.ground.land.park).toBe(0x555555);
    expect(merged.ground.land.sand).toBe(0x444444);
    expect(merged.ground.land.lake).toBe(0x666666);
    expect(merged.ground.base).toBe(0x111111);
    expect(merged.ground.water).toBe(0x222222);
  });

  it("merges road class styles by key and per field", () => {
    const merged = mergeVisualProfile(parent, {
      id: "c", label: "C",
      roads: { classes: { primary: { fill: 0x777778 }, motorway: { fill: 0xaaaaaa, casing: 0xbbbbbb } } },
    });
    expect(merged.roads.classes.primary).toEqual({ fill: 0x777778, casing: 0x888888 });
    expect(merged.roads.classes.motorway).toEqual({ fill: 0xaaaaaa, casing: 0xbbbbbb });
    expect(merged.roads.base).toEqual({ fill: 0x555555, casing: 0x666666 });
  });

  it("requires complete styles for brand-new road classes and building types", () => {
    expect(() => mergeVisualProfile(parent, { id: "c", label: "C", roads: { classes: { motorway: { fill: 0x1 } } } })).toThrow();
    expect(() => mergeVisualProfile(parent, { id: "c", label: "C", buildings: { typeStyles: { temple: { roof: 0x1 } } } })).toThrow();
    const merged = mergeVisualProfile(parent, { id: "c", label: "C", buildings: { typeStyles: { temple: { roof: 0x1, facade: 0x2 } } } });
    expect(merged.buildings.typeStyles.temple).toEqual({ roof: 0x1, facade: 0x2 });
  });

  it("merges an existing building type per field", () => {
    const merged = mergeVisualProfile(parent, { id: "c", label: "C", buildings: { typeStyles: { historic: { roof: 0x999999 } } } });
    expect(merged.buildings.typeStyles.historic).toEqual({ roof: 0x999999, facade: 0x202020 });
  });

  it("replaces palettes wholesale (no concatenation) and rejects empty palettes", () => {
    const merged = mergeVisualProfile(parent, { id: "c", label: "C", buildings: { roofPalette: [0x1], facadePalette: [0x2] } });
    expect(merged.buildings.roofPalette).toEqual([0x1]);
    expect(merged.buildings.facadePalette).toEqual([0x2]);
    expect(() => mergeVisualProfile(parent, { id: "c", label: "C", buildings: { roofPalette: [] } })).toThrow();
    expect(() => mergeVisualProfile(parent, { id: "c", label: "C", buildings: { facadePalette: [] } })).toThrow();
    const kept = mergeVisualProfile(parent, { id: "c", label: "C" });
    expect(kept.buildings.roofPalette).toEqual([0xcccccccc, 0xdddddddd]);
  });

  it("merges nested sidewalk/markings/depth2d/identity, preserving the rest", () => {
    const merged = mergeVisualProfile(parent, {
      id: "c", label: "C",
      roads: { sidewalk: { fill: 0x121212 }, markings: { fill: 0x343434 } },
      buildings: { outline: 0x565656, depth2d: { shadowAlpha: 0.25 } },
      identity: { roofFamily: "c-roof" },
    });
    expect(merged.roads.sidewalk).toEqual({ fill: 0x121212, curb: 0xaaaaaaaa });
    expect(merged.roads.markings).toEqual({ fill: 0x343434 });
    expect(merged.buildings.outline).toBe(0x565656);
    expect(merged.buildings.depth2d).toEqual({ shadowColor: 0x404040, shadowAlpha: 0.25, edgeLight: 0x505050, edgeDark: 0x606060 });
    expect(merged.identity).toEqual({ roofFamily: "c-roof", sidewalkFamily: "f-sidewalk", vegetationFamily: "f-veg", streetFurnitureFamily: "f-furn" });
  });
});

describe("stableStringHash", () => {
  it("is deterministic and returns a uint32", () => {
    expect(stableStringHash("feature:123:default")).toBe(stableStringHash("feature:123:default"));
    const value = stableStringHash("any");
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(0xffffffff);
  });

  it("differs for different inputs (the theme id joins the seed)", () => {
    expect(stableStringHash("b1:paris")).not.toBe(stableStringHash("b1:rome"));
  });
});

describe("default profile baseline", () => {
  it("carries the current renderer palette verbatim", () => {
    expect(defaultProfile.ground.water).toBe(0x5b86a6);
    expect(defaultProfile.ground.base).toBe(0x91a477);
    expect(defaultProfile.ground.land.park).toBe(0x6f9a4e);
    expect(defaultProfile.ground.land.unknown).toBe(0x8b9d70);
    expect(defaultProfile.roads.base).toEqual({ fill: 0x53515a, casing: 0x302e38 });
    expect(defaultProfile.roads.classes.motorway).toEqual({ fill: 0x3a3840, casing: 0x242228 });
    expect(defaultProfile.roads.classes.residential).toEqual({ fill: 0x56545d, casing: 0x33313a });
    expect(defaultProfile.roads.sidewalk.fill).toBe(0x9a9a92);
    expect(defaultProfile.roads.markings.fill).toBe(0xffffff);
    expect(defaultProfile.buildings.roofPalette).toEqual([0xb18d77, 0xa86f5d, 0x9c8468, 0x8f7f8a, 0x9a7a5a, 0x7d7a86, 0xc2a074, 0x96714f]);
    expect(defaultProfile.buildings.facadePalette).toEqual([0x806c61, 0x6f5d52, 0x756a63, 0x6a5f6b, 0x7a6a58, 0x64616c, 0x94795a, 0x7a5a42]);
    expect(defaultProfile.buildings.typeStyles.historic).toEqual({ roof: 0xa86f5d, facade: 0x8a5f52 });
    expect(defaultProfile.buildings.outline).toBe(0x27232c);
  });

  it("is a complete, valid profile (schema v1, non-empty palettes)", () => {
    expect(defaultProfile.schemaVersion).toBe(1);
    expect(defaultProfile.id).toBe("default");
    expect(defaultProfile.label.length).toBeGreaterThan(0);
    expect(defaultProfile.buildings.roofPalette.length).toBeGreaterThan(0);
    expect(defaultProfile.buildings.facadePalette.length).toBeGreaterThan(0);
  });
});
