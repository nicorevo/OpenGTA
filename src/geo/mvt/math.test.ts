import { describe, expect, it } from "vitest";
import { MAX_MERCATOR_LATITUDE, latLonToTile, lonLatToMercator, mercatorToLonLat, tileBounds, tilePointToLonLat } from "./math.ts";

const LECCE = { latitude: 40.35316888888889, longitude: 18.17259 };
const ORIGIN_SHIFT = 20037508.342789244;

describe("latLonToTile", () => {
  it("maps Lecce to the committed z14 tile 9019/6181", () => {
    expect(latLonToTile(LECCE.latitude, LECCE.longitude, 14)).toEqual({ z: 14, x: 9019, y: 6181 });
  });

  it("is deterministic across repeated calls", () => {
    const first = latLonToTile(LECCE.latitude, LECCE.longitude, 16);
    for (let index = 0; index < 8; index += 1) {
      expect(latLonToTile(LECCE.latitude, LECCE.longitude, 16)).toEqual(first);
    }
    expect(first).toEqual({ z: 16, x: 36076, y: 24726 });
  });

  it("maps the whole world to the single z0 tile", () => {
    for (const latitude of [85, 0, -85]) {
      for (const longitude of [-180, -90, 0, 90, 180]) {
        expect(latLonToTile(latitude, longitude, 0)).toEqual({ z: 0, x: 0, y: 0 });
      }
    }
  });

  it("clamps latitude to the Web Mercator limit", () => {
    const north = latLonToTile(89, 12, 4);
    expect(north).toEqual(latLonToTile(MAX_MERCATOR_LATITUDE, 12, 4));
    expect(latLonToTile(90, 12, 4)).toEqual(north);
    expect(Number.isFinite(north.y)).toBe(true);
    expect(north.y).toBe(0);
    const south = latLonToTile(-90, 12, 4);
    expect(south).toEqual(latLonToTile(-MAX_MERCATOR_LATITUDE, 12, 4));
    expect(south.y).toBe(2 ** 4 - 1);
  });

  it("clamps longitude to the antimeridian", () => {
    expect(latLonToTile(0, 180, 3).x).toBe(2 ** 3 - 1);
    expect(latLonToTile(0, 200, 3)).toEqual(latLonToTile(0, 180, 3));
    expect(latLonToTile(0, -180, 3).x).toBe(0);
    expect(latLonToTile(0, -300, 3)).toEqual(latLonToTile(0, -180, 3));
  });

  it("never produces NaN, Infinity or out of grid indices", () => {
    for (let zoom = 0; zoom <= 24; zoom += 1) {
      const size = 2 ** zoom;
      for (const latitude of [-90, -85.05113, -45, 0, 45, 85.05113, 90]) {
        for (const longitude of [-180, -179.999, -1e-9, 0, 1e-9, 179.999, 180]) {
          const tile = latLonToTile(latitude, longitude, zoom);
          expect(Number.isFinite(tile.x)).toBe(true);
          expect(Number.isFinite(tile.y)).toBe(true);
          expect(Number.isInteger(tile.x)).toBe(true);
          expect(Number.isInteger(tile.y)).toBe(true);
          expect(tile.x).toBeGreaterThanOrEqual(0);
          expect(tile.x).toBeLessThan(size);
          expect(tile.y).toBeGreaterThanOrEqual(0);
          expect(tile.y).toBeLessThan(size);
          expect(tile.z).toBe(zoom);
        }
      }
    }
  });

  it("rejects non-finite coordinates and invalid zoom levels", () => {
    for (const latitude of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => latLonToTile(latitude, 0, 4)).toThrow(RangeError);
    }
    expect(() => latLonToTile(0, Number.NaN, 4)).toThrow(RangeError);
    expect(() => latLonToTile(0, Number.POSITIVE_INFINITY, 4)).toThrow(RangeError);
    for (const zoom of [-1, 1.5, 25, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => latLonToTile(0, 0, zoom)).toThrow(RangeError);
    }
  });
});

describe("tileBounds", () => {
  it("returns the lon/lat box of the Lecce tile containing Lecce", () => {
    const bounds = tileBounds(14, 9019, 6181);
    expect(bounds.west).toBeLessThan(LECCE.longitude);
    expect(bounds.east).toBeGreaterThan(LECCE.longitude);
    expect(bounds.south).toBeLessThan(LECCE.latitude);
    expect(bounds.north).toBeGreaterThan(LECCE.latitude);
    expect(bounds.north).toBeGreaterThan(bounds.south);
    expect(bounds.east).toBeGreaterThan(bounds.west);
  });

  it("covers the whole world at z0 with the Mercator latitude limits", () => {
    const bounds = tileBounds(0, 0, 0);
    expect(bounds.west).toBeCloseTo(-180, 9);
    expect(bounds.east).toBeCloseTo(180, 9);
    expect(bounds.north).toBeCloseTo(MAX_MERCATOR_LATITUDE, 5);
    expect(bounds.south).toBeCloseTo(-MAX_MERCATOR_LATITUDE, 5);
  });

  it("tiles the grid without gaps or overlaps", () => {
    for (const zoom of [1, 8, 14]) {
      const size = 2 ** zoom;
      const row = Math.min(3, size - 1);
      const column = Math.min(1, size - 1);
      for (const x of new Set([0, column, Math.floor(size / 2), size - 1])) {
        const bounds = tileBounds(zoom, x, row);
        if (x + 1 < size) {
          expect(tileBounds(zoom, x + 1, row).west).toBeCloseTo(bounds.east, 9);
        }
        if (row + 1 < size) {
          expect(tileBounds(zoom, x, row + 1).north).toBeCloseTo(bounds.south, 9);
        }
      }
    }
  });

  it("keeps every bound finite for every zoom level", () => {
    for (let zoom = 0; zoom <= 24; zoom += 1) {
      const bounds = tileBounds(zoom, 0, 0);
      for (const value of [bounds.north, bounds.south, bounds.west, bounds.east]) {
        expect(Number.isFinite(value)).toBe(true);
      }
      expect(Math.abs(bounds.north)).toBeLessThanOrEqual(90);
      expect(Math.abs(bounds.south)).toBeLessThanOrEqual(90);
      expect(Math.abs(bounds.west)).toBeLessThanOrEqual(180);
      expect(Math.abs(bounds.east)).toBeLessThanOrEqual(180);
    }
  });

  it("rejects invalid zoom and out of grid tile indices", () => {
    for (const zoom of [-1, 14.5, 25, Number.NaN]) {
      expect(() => tileBounds(zoom, 0, 0)).toThrow(RangeError);
    }
    expect(() => tileBounds(14, -1, 0)).toThrow(RangeError);
    expect(() => tileBounds(14, 16384, 0)).toThrow(RangeError);
    expect(() => tileBounds(14, 0, 16384)).toThrow(RangeError);
    expect(() => tileBounds(14, 0.5, 0)).toThrow(RangeError);
  });
});

describe("mercator projection", () => {
  it("projects the origin and the antimeridian to Web Mercator meters", () => {
    expect(lonLatToMercator(0, 0).x).toBe(0);
    expect(lonLatToMercator(0, 0).y).toBeCloseTo(0, 6);
    expect(lonLatToMercator(180, 0).x).toBeCloseTo(ORIGIN_SHIFT, 6);
    expect(lonLatToMercator(-180, 0).x).toBeCloseTo(-ORIGIN_SHIFT, 6);
    // The contract constant is rounded, so the projected northing stays within a couple of meters.
    expect(ORIGIN_SHIFT - lonLatToMercator(0, MAX_MERCATOR_LATITUDE).y).toBeGreaterThan(-2);
    expect(ORIGIN_SHIFT - lonLatToMercator(0, MAX_MERCATOR_LATITUDE).y).toBeLessThan(2);
  });

  it("round trips lon/lat through meters", () => {
    const samples = [
      LECCE,
      { latitude: 0, longitude: 0 },
      { latitude: 60, longitude: -120 },
      { latitude: -45.5, longitude: 179.9 },
    ];
    for (const sample of samples) {
      const point = lonLatToMercator(sample.longitude, sample.latitude);
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
      const back = mercatorToLonLat(point.x, point.y);
      expect(back.longitude).toBeCloseTo(sample.longitude, 9);
      expect(back.latitude).toBeCloseTo(sample.latitude, 6);
    }
    const pole = lonLatToMercator(18.17259, MAX_MERCATOR_LATITUDE);
    expect(mercatorToLonLat(pole.x, pole.y).latitude).toBeCloseTo(MAX_MERCATOR_LATITUDE, 5);
  });

  it("clamps out of world northing to the Mercator limit", () => {
    const north = mercatorToLonLat(0, 1e12);
    const south = mercatorToLonLat(0, -1e12);
    expect(north.latitude).toBeCloseTo(MAX_MERCATOR_LATITUDE, 5);
    expect(south.latitude).toBeCloseTo(-MAX_MERCATOR_LATITUDE, 5);
    expect(north.longitude).toBe(0);
    expect(Number.isFinite(north.latitude)).toBe(true);
    expect(Number.isFinite(south.latitude)).toBe(true);
  });

  it("rejects non-finite input", () => {
    expect(() => lonLatToMercator(Number.NaN, 0)).toThrow(RangeError);
    expect(() => lonLatToMercator(0, Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => mercatorToLonLat(Number.NaN, 0)).toThrow(RangeError);
    expect(() => mercatorToLonLat(0, Number.NEGATIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("tilePointToLonLat", () => {
  it("maps the tile-local corners and center of the Lecce tile", () => {
    const bounds = tileBounds(14, 9019, 6181);
    const northWest = tilePointToLonLat(14, 9019, 6181, { x: 0, y: 0 });
    expect(northWest.longitude).toBeCloseTo(bounds.west, 9);
    expect(northWest.latitude).toBeCloseTo(bounds.north, 9);
    const southEast = tilePointToLonLat(14, 9019, 6181, { x: 4096, y: 4096 });
    expect(southEast.longitude).toBeCloseTo(bounds.east, 9);
    expect(southEast.latitude).toBeCloseTo(bounds.south, 9);
    const northWestMeters = lonLatToMercator(bounds.west, bounds.north);
    const southEastMeters = lonLatToMercator(bounds.east, bounds.south);
    const center = tilePointToLonLat(14, 9019, 6181, { x: 2048, y: 2048 });
    const expected = mercatorToLonLat((northWestMeters.x + southEastMeters.x) / 2, (northWestMeters.y + southEastMeters.y) / 2);
    expect(center.longitude).toBeCloseTo(expected.longitude, 9);
    expect(center.latitude).toBeCloseTo(expected.latitude, 9);
    expect(center.latitude).toBeGreaterThan(bounds.south);
    expect(center.latitude).toBeLessThan(bounds.north);
  });

  it("accepts coordinates outside the tile extent (buffer area)", () => {
    const buffered = tilePointToLonLat(14, 9019, 6181, { x: -256, y: 4096 + 256 });
    expect(Number.isFinite(buffered.longitude)).toBe(true);
    expect(Number.isFinite(buffered.latitude)).toBe(true);
    const bounds = tileBounds(14, 9019, 6181);
    expect(buffered.longitude).toBeLessThan(bounds.west);
    expect(buffered.latitude).toBeLessThan(bounds.south);
  });

  it("honours a custom extent and validates its arguments", () => {
    const center = tilePointToLonLat(0, 0, 0, { x: 256, y: 256 }, 512);
    expect(center.longitude).toBeCloseTo(0, 9);
    expect(center.latitude).toBeCloseTo(0, 9);
    expect(() => tilePointToLonLat(0, 0, 0, { x: 0, y: 0 }, 0)).toThrow(RangeError);
    expect(() => tilePointToLonLat(0, 0, 0, { x: Number.NaN, y: 0 })).toThrow(RangeError);
    expect(() => tilePointToLonLat(-1, 0, 0, { x: 0, y: 0 })).toThrow(RangeError);
  });
});
