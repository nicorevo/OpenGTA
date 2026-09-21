import { Graphics, Point } from "pixi.js";
import { describe, expect, it } from "vitest";
import { buildingStyle, defaultProfile, groundFill, roadStyle } from "../theme/index.ts";
import { dashSegments, drawPolygon, positionSeed, roadMarkingsEnabled, sidewalkEnabled, sidewalkPadPx } from "./renderer.ts";

describe("Pixi polygon rendering", () => {
  it("keeps canonical holes transparent", () => {
    const graphics = new Graphics();

    drawPolygon(graphics, {
      outer: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
      holes: [[{ x: 2, y: 2 }, { x: 2, y: 8 }, { x: 8, y: 8 }, { x: 8, y: 2 }]],
    }, 1, 0, 0xffffff);

    expect(graphics.containsPoint(new Point(1, -1))).toBe(true);
    expect(graphics.containsPoint(new Point(5, -5))).toBe(false);
  });
});

describe("close-zoom street detail helpers", () => {
  it("scales the per-side pavement band with the view scale (meters)", () => {
    expect(sidewalkPadPx(1)).toBe(1.8);
    expect(sidewalkPadPx(10)).toBe(18);
    expect(sidewalkPadPx(35)).toBeCloseTo(63);
  });

  it("shows pavement and the center line from the medium tier up", () => {
    expect(sidewalkEnabled("body")).toBe(false);
    expect(sidewalkEnabled("casing")).toBe(true);
    expect(sidewalkEnabled("marking")).toBe(true);
    expect(roadMarkingsEnabled("body")).toBe(false);
    expect(roadMarkingsEnabled("casing")).toBe(true);
    expect(roadMarkingsEnabled("marking")).toBe(true);
  });

  const line = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y1 }];

  it("emits fixed-length dashes with gaps along a straight centerline", () => {
    const segments = dashSegments(line(0, 0, 20, 0), 2.5, 2.5);
    expect(segments).toHaveLength(4);
    expect(segments[0]).toEqual([{ x: 0, y: 0 }, { x: 2.5, y: 0 }]);
    expect(segments[3]).toEqual([{ x: 15, y: 0 }, { x: 17.5, y: 0 }]);
  });

  it("keeps every dash at the requested world length", () => {
    for (const [a, b] of dashSegments(line(0, 0, 20, 0), 2.5, 2.5)) {
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(2.5);
    }
  });

  it("emits a single clipped dash for a short centerline", () => {
    const segments = dashSegments(line(0, 0, 1, 0), 2.5, 2.5);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
  });

  it("returns nothing for degenerate input", () => {
    expect(dashSegments([], 2.5, 2.5)).toEqual([]);
    expect(dashSegments([{ x: 0, y: 0 }], 2.5, 2.5)).toEqual([]);
    expect(dashSegments(line(0, 0, 10, 0), 0, 2.5)).toEqual([]);
    expect(dashSegments(line(0, 0, 10, 0), 2.5, -1)).toEqual([]);
  });
});

describe("GTA world palette (default profile: class/styleKey -> color)", () => {
  it("colors ground by land class with distinct GTA-muted tones", () => {
    expect(groundFill(defaultProfile, "land", "park")).not.toBe(groundFill(defaultProfile, "land", "sand"));
    expect(groundFill(defaultProfile, "land", "forest")).not.toBe(groundFill(defaultProfile, "land", "parking"));
    expect(groundFill(defaultProfile, "land", "parking")).not.toBe(groundFill(defaultProfile, "land", "residential"));
    expect(groundFill(defaultProfile, "land", "industrial")).not.toBe(groundFill(defaultProfile, "land", "grass"));
  });

  it("keeps water distinct from land and defaults unknown land to the base tone", () => {
    expect(groundFill(defaultProfile, "water", "lake")).not.toBe(groundFill(defaultProfile, "land", "park"));
    expect(groundFill(defaultProfile, "land", "unknown")).toBe(groundFill(defaultProfile, "land", "generic"));
  });

  it("styles roads by class band: arterials differ from local streets", () => {
    expect(roadStyle(defaultProfile, "motorway").fill).not.toBe(roadStyle(defaultProfile, "residential").fill);
    expect(roadStyle(defaultProfile, "primary").fill).not.toBe(roadStyle(defaultProfile, "service").fill);
    // unmapped classes fall back to the stable base asphalt
    expect(roadStyle(defaultProfile, "path")).toEqual(roadStyle(defaultProfile, "not-a-class"));
  });

  it("buildingStyle is deterministic per seed and varies across seeds", () => {
    expect(buildingStyle(defaultProfile, "unknown", 12345)).toEqual(buildingStyle(defaultProfile, "unknown", 12345));
    const a = buildingStyle(defaultProfile, "unknown", 1);
    const b = buildingStyle(defaultProfile, "unknown", 2);
    expect(a.roof !== b.roof || a.facade !== b.facade).toBe(true);
  });

  it("buildingStyle pins characteristic types regardless of the seed", () => {
    expect(buildingStyle(defaultProfile, "historic", 0).roof).toBe(buildingStyle(defaultProfile, "historic", 999).roof);
    expect(buildingStyle(defaultProfile, "industrial", 1).facade).toBe(buildingStyle(defaultProfile, "industrial", 42).facade);
  });

  it("positionSeed is stable per world position, jitter-tolerant and spread out", () => {
    expect(positionSeed(10.4, -3.2)).toBe(positionSeed(10.4, -3.2));
    expect(positionSeed(10.4, -3.2)).toBe(positionSeed(10.4, -3.1)); // sub-meter rounding
    expect(positionSeed(10, 0)).not.toBe(positionSeed(9999, 5));
  });
});
