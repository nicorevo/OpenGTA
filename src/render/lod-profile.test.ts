import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lodForZoom, type LodTier, type ZoomLevel } from "../app/camera.ts";
import { LOD_PROFILES, LOD_TIERS, lodProfileForTier, lodProfileForZoom } from "./lod-profile.ts";

/** Detail ladder of the road presentation, from the least to the most detailed stage. */
const ROAD_DETAIL_ORDER: Readonly<Record<string, number>> = { body: 0, casing: 1, marking: 2 };
const ALL_LEVELS: readonly ZoomLevel[] = [0, 1, 2, 3, 4, 5];

describe("LOD presentation profile", () => {
  it("defines one frozen profile per tier with the four presentation parameters", () => {
    expect([...LOD_TIERS].sort()).toEqual(["far", "medium", "near"]);

    for (const tier of LOD_TIERS) {
      const profile = lodProfileForTier(tier);

      expect(Object.isFrozen(profile)).toBe(true);
      expect(Number.isFinite(profile.facadeStrength)).toBe(true);
      expect(profile.facadeStrength).toBeGreaterThanOrEqual(0);
      expect(profile.facadeStrength).toBeLessThanOrEqual(1);
      expect(Number.isFinite(profile.labelMinPriority)).toBe(true);
      expect(profile.labelMinPriority).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(profile.cullMinAreaPx2)).toBe(true);
      expect(profile.cullMinAreaPx2).toBeGreaterThanOrEqual(0);
      expect(Object.keys(ROAD_DETAIL_ORDER)).toContain(profile.roadDetail);
    }
  });

  it("grows the facade strength as the camera zooms in", () => {
    const far = lodProfileForTier("far");
    const medium = lodProfileForTier("medium");
    const near = lodProfileForTier("near");

    expect(far.facadeStrength).toBe(0);
    expect(medium.facadeStrength).toBe(0.6);
    expect(near.facadeStrength).toBe(1);
    expect(far.facadeStrength).toBeLessThan(medium.facadeStrength);
    expect(medium.facadeStrength).toBeLessThan(near.facadeStrength);
  });

  it("drops road detail as the camera zooms out", () => {
    expect(lodProfileForTier("far").roadDetail).toBe("body");
    expect(lodProfileForTier("medium").roadDetail).toBe("casing");
    expect(lodProfileForTier("near").roadDetail).toBe("marking");

    const stage = (tier: LodTier): number => ROAD_DETAIL_ORDER[lodProfileForTier(tier).roadDetail];
    expect(stage("far")).toBeLessThan(stage("medium"));
    expect(stage("medium")).toBeLessThan(stage("near"));
  });

  it("raises the label threshold as the camera zooms out", () => {
    const far = lodProfileForTier("far");
    const medium = lodProfileForTier("medium");
    const near = lodProfileForTier("near");

    expect(near.labelMinPriority).toBe(0);
    expect(medium.labelMinPriority).toBeGreaterThan(near.labelMinPriority);
    expect(far.labelMinPriority).toBeGreaterThan(medium.labelMinPriority);
    expect(far.labelMinPriority).toBeLessThanOrEqual(110);
  });

  it("raises the culling threshold as the camera zooms out", () => {
    const far = lodProfileForTier("far");
    const medium = lodProfileForTier("medium");
    const near = lodProfileForTier("near");

    expect(near.cullMinAreaPx2).toBe(0);
    expect(medium.cullMinAreaPx2).toBeGreaterThan(near.cullMinAreaPx2);
    expect(far.cullMinAreaPx2).toBeGreaterThan(medium.cullMinAreaPx2);
  });

  it("makes every parameter monotone across the tier order", () => {
    const profiles = LOD_TIERS.map((tier) => lodProfileForTier(tier));

    expect(profiles.map((profile) => profile.facadeStrength)).toEqual([0, 0.6, 1]);
    expect(profiles.map((profile) => profile.labelMinPriority)).toEqual([100, 60, 0]);
    expect(profiles.map((profile) => profile.cullMinAreaPx2)).toEqual([64, 16, 0]);
    expect(profiles.every((profile, index) => index === 0 || profile.facadeStrength > profiles[index - 1].facadeStrength)).toBe(true);
    expect(profiles.every((profile, index) => index === 0 || profile.cullMinAreaPx2 < profiles[index - 1].cullMinAreaPx2)).toBe(true);
  });
});

describe("LOD profile resolution", () => {
  it("resolves the tier profile from every zoom level without a second mapping", () => {
    for (const level of ALL_LEVELS) {
      expect(lodProfileForZoom(level)).toBe(lodProfileForTier(lodForZoom(level)));
    }

    expect(lodProfileForZoom(0)).toBe(lodProfileForZoom(1));
    expect(lodProfileForZoom(1)).not.toBe(lodProfileForZoom(2));
    expect(lodProfileForZoom(2)).toBe(lodProfileForZoom(3));
    expect(lodProfileForZoom(4)).toBe(lodProfileForZoom(5));
  });

  it("shares one immutable profile instance per tier", () => {
    expect(lodProfileForZoom(0)).toBe(LOD_PROFILES.far);
    expect(lodProfileForZoom(1)).toBe(LOD_PROFILES.far);
    expect(lodProfileForZoom(2)).toBe(LOD_PROFILES.medium);
    expect(lodProfileForZoom(3)).toBe(LOD_PROFILES.medium);
    expect(lodProfileForZoom(4)).toBe(LOD_PROFILES.near);
    expect(lodProfileForZoom(5)).toBe(LOD_PROFILES.near);
    expect(Object.isFrozen(LOD_PROFILES)).toBe(true);
  });

  it("clamps levels outside 0..5 before resolving the profile", () => {
    expect(lodProfileForZoom(-1 as ZoomLevel)).toBe(LOD_PROFILES.far);
    expect(lodProfileForZoom(9 as ZoomLevel)).toBe(LOD_PROFILES.near);
    expect(lodProfileForZoom(Number.NaN as ZoomLevel)).toBe(LOD_PROFILES.medium);
  });
});

describe("LOD profile module purity", () => {
  it("keeps the contract free of Pixi, Rapier and DOM", () => {
    const source = readFileSync(new URL("./lod-profile.ts", import.meta.url), "utf8");
    const imports = [...source.matchAll(/^import .*$/gm)].map((match) => match[0]);

    expect(imports.every((line) => line.includes('"../app/camera.ts"'))).toBe(true);
    expect(source).not.toMatch(/pixi|rapier|document|window/i);
  });
});
