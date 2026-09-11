import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ZOOM_STEPS, cameraBounds, clampZoom, lodForZoom, zoomFactor } from "./camera.ts";

const SCREEN = { width: 1280, height: 720 };
const POSITION = { x: 120, y: -45 };
const DEFAULT_ZOOM = 2;

describe("camera zoom levels", () => {
  it("clamps levels outside 0..4 to the discrete range", () => {
    expect(clampZoom(-3)).toBe(0);
    expect(clampZoom(0)).toBe(0);
    expect(clampZoom(4)).toBe(4);
    expect(clampZoom(9)).toBe(4);
  });

  it("rounds fractional levels and falls back to the default on non-finite input", () => {
    expect(clampZoom(2.4)).toBe(2);
    expect(clampZoom(2.6)).toBe(3);
    expect(clampZoom(Number.NaN)).toBe(DEFAULT_ZOOM);
    expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(DEFAULT_ZOOM);
  });

  it("maps every level to an experimental factor that grows with zoom in", () => {
    const factors = ZOOM_STEPS.map((_, level) => zoomFactor(clampZoom(level)));

    expect(ZOOM_STEPS).toHaveLength(5);
    expect(zoomFactor(DEFAULT_ZOOM)).toBe(1);
    expect(factors.every((factor, index) => index === 0 || factor > factors[index - 1])).toBe(true);
  });

  it("maps levels to the initial LOD tiers of the design", () => {
    expect([0, 1, 2, 3, 4].map((level) => lodForZoom(clampZoom(level)))).toEqual(["far", "far", "medium", "near", "near"]);
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
    const near = cameraBounds(POSITION, SCREEN, zoomFactor(4));
    const medium = cameraBounds(POSITION, SCREEN, zoomFactor(2));
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
