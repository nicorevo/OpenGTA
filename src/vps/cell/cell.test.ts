import { describe, it, expect } from "vitest";
import { cellForCoordinates, URBAN_CELL_RESOLUTION } from "./cell.ts";
import type { SpatialCell } from "../evidence/types.ts";

const M_PER_DEG_LAT = 111_320;

function metersLat(cell: SpatialCell): number {
  return (cell.bounds.north - cell.bounds.south) * M_PER_DEG_LAT;
}

function metersLon(cell: SpatialCell): number {
  return (cell.bounds.east - cell.bounds.west) * M_PER_DEG_LAT * Math.cos((cell.center.latitude * Math.PI) / 180);
}

describe("cellForCoordinates (VPS-04, spec 10-12)", () => {
  it("returns the documented SpatialCell contract", () => {
    const cell = cellForCoordinates(41.8992, 12.4769);
    expect(cell.id).toMatch(/^h3:[0-9a-f]{15}$/);
    expect(cell.resolution).toBe(URBAN_CELL_RESOLUTION);
    expect(cell.resolution).toBe(9);
    expect(cell.center.latitude).toBeGreaterThanOrEqual(-90);
    expect(cell.center.latitude).toBeLessThanOrEqual(90);
    expect(cell.center.longitude).toBeGreaterThanOrEqual(-180);
    expect(cell.center.longitude).toBeLessThanOrEqual(180);
    expect(cell.bounds.south).toBeLessThanOrEqual(cell.bounds.north);
    expect(cell.bounds.west).toBeLessThanOrEqual(cell.bounds.east);
  });

  it("is deterministic: same coordinates always map to the same cell", () => {
    const a = cellForCoordinates(41.8992, 12.4769);
    const b = cellForCoordinates(41.8992, 12.4769);
    expect(b).toEqual(a);
  });

  it("keeps nearby points (tens of meters) in the same cell", () => {
    // ~50 m south-west of the Rome fixture center
    const a = cellForCoordinates(41.8992, 12.4769);
    const b = cellForCoordinates(41.8992 - 0.00045, 12.4769 - 0.00061);
    expect(b.id).toBe(a.id);
  });

  it("maps the three evidence-fixture cities to distinct cells", () => {
    const rome = cellForCoordinates(41.8992, 12.4769);
    const paris = cellForCoordinates(48.8566, 2.3522);
    const tokyo = cellForCoordinates(35.6762, 139.6503);
    expect(rome.id).not.toBe(paris.id);
    expect(rome.id).not.toBe(tokyo.id);
    expect(paris.id).not.toBe(tokyo.id);
  });

  it("contains the input point inside the cell bounds", () => {
    for (const [lat, lon] of [
      [41.8992, 12.4769],
      [48.8566, 2.3522],
      [35.6762, 139.6503],
      [40.35, 18.17],
    ]) {
      const cell = cellForCoordinates(lat, lon);
      expect(lat).toBeGreaterThanOrEqual(cell.bounds.south);
      expect(lat).toBeLessThanOrEqual(cell.bounds.north);
      expect(lon).toBeGreaterThanOrEqual(cell.bounds.west);
      expect(lon).toBeLessThanOrEqual(cell.bounds.east);
    }
  });

  it("keeps the urban cell in the MVP 300-700 m band (spec 12)", () => {
    const cell = cellForCoordinates(41.8992, 12.4769);
    expect(metersLat(cell)).toBeGreaterThan(250);
    expect(metersLat(cell)).toBeLessThan(900);
    expect(metersLon(cell)).toBeGreaterThan(250);
    expect(metersLon(cell)).toBeLessThan(900);
  });

  it("supports other resolutions with smaller, distinct cells", () => {
    const res9 = cellForCoordinates(41.8992, 12.4769, 9);
    const res10 = cellForCoordinates(41.8992, 12.4769, 10);
    expect(res10.id).not.toBe(res9.id);
    expect(res10.resolution).toBe(10);
    expect(metersLat(res10)).toBeLessThan(metersLat(res9));
  });

  it("rejects out-of-range or non-finite coordinates", () => {
    expect(() => cellForCoordinates(91, 0)).toThrow(RangeError);
    expect(() => cellForCoordinates(-91, 0)).toThrow(RangeError);
    expect(() => cellForCoordinates(0, 181)).toThrow(RangeError);
    expect(() => cellForCoordinates(0, -181)).toThrow(RangeError);
    expect(() => cellForCoordinates(Number.NaN, 0)).toThrow(RangeError);
    expect(() => cellForCoordinates(0, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
