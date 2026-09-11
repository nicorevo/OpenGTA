import type { GeoProjector } from "../coordinates/projector.ts";
import type { DecodedPolygonGeometry } from "../mvt/decode.ts";
import { tilePointToLonLat, type SlippyTile } from "../mvt/math.ts";
import type { Polygon2D, Vec2, WorldWarning } from "../../world/model/types.ts";

/** Tile-local MVT geometry to tangent-plane meters: the single tested path. */
export function tilePointsToMeters(points: readonly { x: number; y: number }[], projector: GeoProjector, tile: SlippyTile, extent: number): Vec2[] {
  return points.map((point) => {
    const lonLat = tilePointToLonLat(tile.z, tile.x, tile.y, point, extent);
    return projector.project(lonLat);
  });
}

export function decodedPolygonToArea(polygon: DecodedPolygonGeometry["polygons"][number], projector: GeoProjector, tile: SlippyTile, extent: number): Polygon2D {
  return {
    outer: tilePointsToMeters(polygon.exterior, projector, tile, extent),
    holes: polygon.holes.map((hole) => tilePointsToMeters(hole, projector, tile, extent)),
  };
}

export function stableTileFeatureId(tile: SlippyTile, layer: string, id: number | undefined, index: number): string {
  return `tile:${tile.z}/${tile.x}/${tile.y}:${layer}:${id ?? `i${index}`}`;
}

export function skipWarning(warnings: WorldWarning[], code: string, message: string, featureId: string): void {
  warnings.push({ code, message, featureId });
}
