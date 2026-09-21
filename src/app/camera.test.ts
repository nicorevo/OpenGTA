import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ZOOM_STEPS, cameraBounds, clampZoom, lodForZoom, zoomFactor, type LodTier, type ZoomLevel } from "./camera.ts";

const SCREEN = { width: 1280, height: 720 };
const POSITION = { x: 120, y: -45 };
const DEFAULT_ZOOM = 3;
const LEVELS: readonly ZoomLevel[] = [0, 1, 2, 3, 4, 5];

describe("camera zoom levels", () => {
  it("clamps levels outside 0..5 to the discrete range", () => {
    expect(clampZoom(-3)).toBe(0);
    expect(clampZoom(0)).toBe(0);
    expect(clampZoom(5)).toBe(5);
    expect(clampZoom(9)).toBe(5);
  });

  it("rounds fractional levels and falls back to the default on non-finite input", () => {
    expect(clampZoom(2.4)).toBe(2);
    expect(clampZoom(2.6)).toBe(3);
    expect(clampZoom(Number.NaN)).toBe(DEFAULT_ZOOM);
    expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(DEFAULT_ZOOM);
  });

  it("maps every level to an experimental factor that grows with zoom in", () => {
    const factors = ZOOM_STEPS.map((_, level) => zoomFactor(clampZoom(level)));

    expect([...ZOOM_STEPS]).toEqual([0.7, 0.85, 2.25, 6.0, 12.0, 24.0]);
    expect(zoomFactor(DEFAULT_ZOOM)).toBe(6);
    expect(factors.every((factor, index) => index === 0 || factor > factors[index - 1])).toBe(true);
  });

  it("keeps every zoom step between far and driving under 3x (ZI)", () => {
    // The overview->driving gap used to jump 0.85 -> 6.0 (7x); the level 2
    // intermediate (~2.25, geometric middle) splits it into two even steps.
    const ratios = ZOOM_STEPS.map((factor, index) => (index === 0 ? 0 : factor / ZOOM_STEPS[index - 1]!));
    expect(ratios.slice(1)).toEqual([0.85 / 0.7, 2.25 / 0.85, 6 / 2.25, 12 / 6, 24 / 12]);
    expect(ratios.every((ratio) => ratio < 3)).toBe(true);
  });

  it("keeps the driving preset separate from the maximum zoom (G2D-01)", () => {
    // The driving preset (level 3) is calibrated for the GTA-2D proportions
    // at 640x480: 6.0 -> 8 px/m with the 360 divisor, so the taxi reads
    // ~40x17 px and a 6 m road ~48 px. The maximum zoom is its own target
    // (level 5 -> 32 px/m at 640x480, close-view detail), not a multiplier
    // of the driving preset.
    expect(zoomFactor(4)).toBe(12);
    expect(zoomFactor(5)).toBe(24);
    expect(zoomFactor(5) / zoomFactor(DEFAULT_ZOOM)).toBeLessThan(10);
  });

  it("shows a drivable stretch ahead of the car at the driving preset", () => {
    // Reference viewport 640x480 of the GTA-2D spec: with the driving factor
    // the camera must keep at least 30 m of road ahead of the car.
    const scale = zoomFactor(DEFAULT_ZOOM) * (480 / 360);
    const bounds = cameraBounds(POSITION, { width: 640, height: 480 }, scale);

    expect(bounds.maxX - POSITION.x).toBeGreaterThanOrEqual(30);
    expect(bounds.minX).toBeLessThan(POSITION.x);
  });

  it("maps levels to the initial LOD tiers of the design", () => {
    expect([0, 1, 2, 3, 4, 5].map((level) => lodForZoom(clampZoom(level)))).toEqual(["far", "far", "medium", "medium", "near", "near"]);
  });
});

describe("camera zoom to LOD policy", () => {
  const TIER_BY_LEVEL: readonly (readonly [ZoomLevel, LodTier])[] = [
    [0, "far"],
    [1, "far"],
    [2, "medium"],
    [3, "medium"],
    [4, "near"],
    [5, "near"],
  ];
  const TIER_RANK: Readonly<Record<LodTier, number>> = { far: 0, medium: 1, near: 2 };

  it("covers every discrete level with exactly one tier", () => {
    for (const [level, tier] of TIER_BY_LEVEL) {
      expect(lodForZoom(level)).toBe(tier);
    }

    const tiers = TIER_BY_LEVEL.map(([, tier]) => tier);
    expect(new Set(tiers)).toEqual(new Set(["far", "medium", "near"]));
    expect(lodForZoom(LEVELS[0])).toBe("far");
    expect(lodForZoom(LEVELS[LEVELS.length - 1])).toBe("near");
  });

  it("clamps out-of-range levels before mapping them", () => {
    expect(lodForZoom(-1 as ZoomLevel)).toBe("far");
    expect(lodForZoom(6 as ZoomLevel)).toBe("near");
    expect(lodForZoom(42 as ZoomLevel)).toBe("near");
    expect(lodForZoom(1.6 as ZoomLevel)).toBe("medium");
  });

  it("stays deterministic and never loses detail as the camera zooms in", () => {
    const ranks = LEVELS.map((level) => TIER_RANK[lodForZoom(level)]);

    expect(lodForZoom(2)).toBe(lodForZoom(2));
    expect(ranks.every((rank, index) => index === 0 || rank >= ranks[index - 1])).toBe(true);
    expect(lodForZoom(0)).toBe(lodForZoom(1));
    expect(lodForZoom(4)).toBe(lodForZoom(5));
    expect(TIER_RANK[lodForZoom(0)]).toBeLessThan(TIER_RANK[lodForZoom(3)]);
    expect(TIER_RANK[lodForZoom(3)]).toBeLessThan(TIER_RANK[lodForZoom(5)]);
  });
});

describe("camera bounds", () => {
  it("stays centered on the camera position", () => {
    const bounds = cameraBounds(POSITION, SCREEN, 1.3);

    expect((bounds.minX + bounds.maxX) / 2).toBeCloseTo(POSITION.x);
    expect((bounds.minY + bounds.maxY) / 2).toBeCloseTo(POSITION.y);
  });

  it("is symmetric around the center and covers the screen at one pixel per meter", () => {
    const bounds = cameraBounds(POSITION, SCREEN, 1);

    expect(POSITION.x - bounds.minX).toBeCloseTo(bounds.maxX - POSITION.x);
    expect(bounds.maxX - bounds.minX).toBeCloseTo(SCREEN.width);
    expect(bounds.maxY - bounds.minY).toBeCloseTo(SCREEN.height);
  });

  it("shrinks on zoom in and widens on zoom out", () => {
    const near = cameraBounds(POSITION, SCREEN, zoomFactor(5));
    const medium = cameraBounds(POSITION, SCREEN, zoomFactor(3));
    const far = cameraBounds(POSITION, SCREEN, zoomFactor(0));

    expect(near.maxX - near.minX).toBeLessThan(medium.maxX - medium.minX);
    expect(medium.maxX - medium.minX).toBeLessThan(far.maxX - far.minX);
    expect(far.maxY - far.minY).toBeGreaterThan(SCREEN.height);
    expect(near.maxY - near.minY).toBeLessThan(SCREEN.height);
  });

  it("rejects a scale without a usable pixel per meter ratio", () => {
    expect(() => cameraBounds(POSITION, SCREEN, 0)).toThrow();
    expect(() => cameraBounds(POSITION, SCREEN, -1)).toThrow();
    expect(() => cameraBounds(POSITION, SCREEN, Number.NaN)).toThrow();
  });
});

describe("camera module purity", () => {
  it("keeps runtime imports free of Pixi, Rapier and DOM", () => {
    const source = readFileSync(new URL("./camera.ts", import.meta.url), "utf8");
    const imports = [...source.matchAll(/^import .*$/gm)].map((match) => match[0]);

    expect(imports.every((line) => line.startsWith("import type "))).toBe(true);
    expect(source).not.toMatch(/pixi|rapier|document|window/i);
  });
});
