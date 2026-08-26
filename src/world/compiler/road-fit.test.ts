import { describe, expect, it } from "vitest";
import { MIN_CARRIAGEWAY_METERS, createFootprintIndex, fitCarriagewayMeters } from "./road-fit.ts";
import type { Polygon2D } from "../model/types.ts";

const box = (minX: number, minY: number, maxX: number, maxY: number): Polygon2D => ({
  outer: [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }],
  holes: [],
});
const eastWest = [{ x: -20, y: 0 }, { x: 20, y: 0 }];

describe("carriageway fitting", () => {
  it("keeps the class width when nothing is in the way", () => {
    const index = createFootprintIndex([]);
    expect(fitCarriagewayMeters(eastWest, 6, index)).toBe(6);
  });

  it("narrows the carriageway to the gap between facing buildings", () => {
    const index = createFootprintIndex([box(-20, 2, 20, 30), box(-20, -30, 20, -2)]);
    const width = fitCarriagewayMeters(eastWest, 6, index);
    expect(width).toBeLessThan(4);
    expect(width).toBeGreaterThanOrEqual(MIN_CARRIAGEWAY_METERS);
  });

  it("never widens a road beyond its declared width", () => {
    expect(fitCarriagewayMeters(eastWest, 3, createFootprintIndex([]))).toBe(3);
  });

  it("falls back to the minimum carriageway when the centerline runs under a building", () => {
    const index = createFootprintIndex([box(-20, -10, 20, 10)]);
    expect(fitCarriagewayMeters(eastWest, 6, index)).toBe(MIN_CARRIAGEWAY_METERS);
  });

  it("ignores buildings that only touch a courtyard the road runs through", () => {
    const courtyard: Polygon2D = { outer: box(-20, -30, 20, 30).outer, holes: [box(-15, -8, 15, 8).outer] };
    expect(fitCarriagewayMeters(eastWest, 6, createFootprintIndex([courtyard]))).toBe(6);
  });

  it("follows the pinch points instead of the average street width", () => {
    const index = createFootprintIndex([box(4, 1.5, 20, 30), box(4, -30, 20, -1.5)]);
    const width = fitCarriagewayMeters(eastWest, 6, index);
    expect(width).toBeLessThan(3);
    expect(width).toBeGreaterThanOrEqual(MIN_CARRIAGEWAY_METERS);
  });

  it("is deterministic", () => {
    const buildings = [box(-20, 3, 20, 30), box(-20, -30, 20, -4)];
    expect(fitCarriagewayMeters(eastWest, 8, createFootprintIndex(buildings))).toBe(fitCarriagewayMeters(eastWest, 8, createFootprintIndex(buildings)));
  });
});
