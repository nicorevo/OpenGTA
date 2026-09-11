/**
 * Tile math for the MVT pipeline (contract C-MVT).
 *
 * Every function is pure and deterministic: no NaN or Infinity can leave this
 * module. Latitude is clamped to the Web Mercator limit, longitude to the
 * antimeridian, and tile indices are kept inside the slippy grid.
 */

/** Latitude limit of the Web Mercator projection used by slippy tiles. */
export const MAX_MERCATOR_LATITUDE = 85.05113;

/** Default tile-local resolution of MVT geometries. */
export const DEFAULT_TILE_EXTENT = 4096;

export const MIN_TILE_ZOOM = 0;
export const MAX_TILE_ZOOM = 24;

const EARTH_RADIUS = 6378137;
const ORIGIN_SHIFT = Math.PI * EARTH_RADIUS;
const WORLD_SIZE = 2 * ORIGIN_SHIFT;
const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

export interface SlippyTile {
  readonly z: number;
  readonly x: number;
  readonly y: number;
}

export interface TileBounds {
  readonly north: number;
  readonly south: number;
  readonly west: number;
  readonly east: number;
}

export interface TilePoint {
  readonly x: number;
  readonly y: number;
}

export interface MercatorPoint {
  readonly x: number;
  readonly y: number;
}

export interface LonLat {
  readonly latitude: number;
  readonly longitude: number;
}

function assertZoom(zoom: number): void {
  if (!Number.isInteger(zoom) || zoom < MIN_TILE_ZOOM || zoom > MAX_TILE_ZOOM) {
    throw new RangeError(`zoom must be an integer between ${MIN_TILE_ZOOM} and ${MAX_TILE_ZOOM}`);
  }
}

function assertTileIndex(value: number, size: number, axis: string): void {
  if (!Number.isInteger(value) || value < 0 || value >= size) {
    throw new RangeError(`${axis} must be an integer between 0 and ${size - 1}`);
  }
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function clampLatitude(latitude: number): number {
  if (!Number.isFinite(latitude)) throw new RangeError("latitude must be finite");
  return clamp(latitude, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
}

function clampLongitude(longitude: number): number {
  if (!Number.isFinite(longitude)) throw new RangeError("longitude must be finite");
  return clamp(longitude, -180, 180);
}

/** Projects lon/lat degrees to EPSG:3857 meters with the spherical Mercator formula. */
export function lonLatToMercator(longitude: number, latitude: number): MercatorPoint {
  if (!Number.isFinite(longitude)) throw new RangeError("longitude must be finite");
  if (!Number.isFinite(latitude)) throw new RangeError("latitude must be finite");
  const phi = latitude * DEG_TO_RAD;
  return {
    x: EARTH_RADIUS * longitude * DEG_TO_RAD,
    y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + phi / 2)),
  };
}

/** Inverse of {@link lonLatToMercator}; the northing is clamped to the Mercator world. */
export function mercatorToLonLat(x: number, y: number): LonLat {
  if (!Number.isFinite(x)) throw new RangeError("mercator x must be finite");
  if (!Number.isFinite(y)) throw new RangeError("mercator y must be finite");
  const northing = clamp(y, -ORIGIN_SHIFT, ORIGIN_SHIFT);
  return {
    latitude: (2 * Math.atan(Math.exp(northing / EARTH_RADIUS)) - Math.PI / 2) * RAD_TO_DEG,
    longitude: x * RAD_TO_DEG / EARTH_RADIUS,
  };
}

function tileMeridian(zoom: number, index: number): number {
  return (index / 2 ** zoom) * WORLD_SIZE - ORIGIN_SHIFT;
}

function tileParallel(zoom: number, index: number): number {
  return ORIGIN_SHIFT - (index / 2 ** zoom) * WORLD_SIZE;
}

/**
 * Converts a geographic coordinate to the slippy tile that contains it.
 * Latitude is clamped to +/-{@link MAX_MERCATOR_LATITUDE}, longitude to +/-180.
 */
export function latLonToTile(latitude: number, longitude: number, zoom: number): SlippyTile {
  assertZoom(zoom);
  const clampedLatitude = clampLatitude(latitude);
  const clampedLongitude = clampLongitude(longitude);
  const mercator = lonLatToMercator(clampedLongitude, clampedLatitude);
  const size = 2 ** zoom;
  return {
    z: zoom,
    x: clamp(Math.floor(((mercator.x + ORIGIN_SHIFT) / WORLD_SIZE) * size), 0, size - 1),
    y: clamp(Math.floor(((ORIGIN_SHIFT - mercator.y) / WORLD_SIZE) * size), 0, size - 1),
  };
}

/** Geographic bounds of a slippy tile: north/west is the (x, y) corner, south/east the (x + 1, y + 1) one. */
export function tileBounds(zoom: number, x: number, y: number): TileBounds {
  assertZoom(zoom);
  const size = 2 ** zoom;
  assertTileIndex(x, size, "x");
  assertTileIndex(y, size, "y");
  const northWest = mercatorToLonLat(tileMeridian(zoom, x), tileParallel(zoom, y));
  const southEast = mercatorToLonLat(tileMeridian(zoom, x + 1), tileParallel(zoom, y + 1));
  return {
    north: northWest.latitude,
    south: southEast.latitude,
    west: northWest.longitude,
    east: southEast.longitude,
  };
}

/**
 * Converts a tile-local point (as decoded from an MVT geometry) to lon/lat.
 * Coordinates outside `[0, extent]` are accepted: MVT buffers them on purpose.
 */
export function tilePointToLonLat(zoom: number, x: number, y: number, point: TilePoint, extent = DEFAULT_TILE_EXTENT): LonLat {
  assertZoom(zoom);
  const size = 2 ** zoom;
  assertTileIndex(x, size, "x");
  assertTileIndex(y, size, "y");
  if (!Number.isInteger(extent) || extent <= 0) throw new RangeError("extent must be a positive integer");
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) throw new RangeError("tile point must be finite");
  return mercatorToLonLat(
    tileMeridian(zoom, x) + (point.x / extent) * (WORLD_SIZE / size),
    tileParallel(zoom, y) - (point.y / extent) * (WORLD_SIZE / size),
  );
}
