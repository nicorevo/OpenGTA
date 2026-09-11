import { latLonToTile, MAX_MERCATOR_LATITUDE, type SlippyTile } from "./math.ts";

export interface GeoBounds { readonly minLatitude: number; readonly minLongitude: number; readonly maxLatitude: number; readonly maxLongitude: number }

/**
 * Deterministic, deduplicated tile coverage of a geographic bounds at a
 * zoom, with Web Mercator clamping. The max edge is inclusive: a bounds
 * ending exactly on a tile edge takes the eastern/southern tile (slippy
 * convention), so seam coverage never under-fetches at tile boundaries.
 */
export function tilesForBounds(bounds: GeoBounds, zoom: number): readonly SlippyTile[] {
  if (![bounds.minLatitude, bounds.minLongitude, bounds.maxLatitude, bounds.maxLongitude].every(Number.isFinite)) throw new RangeError("tile coverage bounds must be finite");
  const south = Math.max(bounds.minLatitude, -MAX_MERCATOR_LATITUDE);
  const north = Math.min(bounds.maxLatitude, MAX_MERCATOR_LATITUDE);
  const min = latLonToTile(south, bounds.minLongitude, zoom);
  const max = latLonToTile(north, bounds.maxLongitude, zoom);
  const tiles: SlippyTile[] = [];
  for (let y = max.y; y <= min.y; y += 1) {
    for (let x = min.x; x <= max.x; x += 1) tiles.push({ z: zoom, x, y });
  }
  return tiles;
}
