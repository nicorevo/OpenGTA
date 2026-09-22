import { latLngToCell, cellToLatLng, cellToBoundary, getResolution } from "h3-js";
import type { GeoBounds, GeoPoint, SpatialCell } from "../evidence/types.ts";

/**
 * MVP urban cell resolution (spec 12: ~300-700 m): with the h3-js build in
 * use, resolution 9 measures ~413 m N-S / ~374 m E-W at 42°N. The public
 * contract is SpatialCell (spec 10); H3 is an implementation detail — the
 * id is an opaque "h3:<index>" string.
 */
export const URBAN_CELL_RESOLUTION = 9;

function assertCoordinates(latitude: number, longitude: number): void {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new RangeError(`Non-finite coordinates: ${latitude}, ${longitude}`);
  }
  if (latitude < -90 || latitude > 90) {
    throw new RangeError(`Latitude out of range [-90, 90]: ${latitude}`);
  }
  if (longitude < -180 || longitude > 180) {
    throw new RangeError(`Longitude out of range [-180, 180]: ${longitude}`);
  }
}

/**
 * Deterministic coordinates → SpatialCell mapping (spec 10-11): the same
 * lat/lon always yields the same cell id, which makes evidence analysis and
 * profile compilation cacheable per cell instead of per coordinate.
 *
 * Known limitation (MVP): bounds are the axis-aligned box of the hexagon
 * corners, so cells crossing the antimeridian (±180°) are not supported yet.
 */
export function cellForCoordinates(
  latitude: number,
  longitude: number,
  resolution: number = URBAN_CELL_RESOLUTION,
): SpatialCell {
  assertCoordinates(latitude, longitude);
  const index = latLngToCell(latitude, longitude, resolution);
  const [centerLat, centerLon] = cellToLatLng(index);
  const corners = cellToBoundary(index);
  let south = Number.POSITIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  let west = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  for (const [cornerLat, cornerLon] of corners) {
    south = Math.min(south, cornerLat);
    north = Math.max(north, cornerLat);
    west = Math.min(west, cornerLon);
    east = Math.max(east, cornerLon);
  }
  const center: GeoPoint = { latitude: centerLat, longitude: centerLon };
  const bounds: GeoBounds = { south, west, north, east };
  return { id: `h3:${index}`, center, bounds, resolution: getResolution(index) };
}
