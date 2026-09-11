import type { GeoProjector } from "../coordinates/projector.ts";
import type { DecodedVectorFeature } from "../mvt/decode.ts";
import type { SlippyTile } from "../mvt/math.ts";
import { decodedPolygonToArea, skipWarning, stableTileFeatureId } from "./mvt-common.ts";
import { validatePolygon } from "../../world/model/types.ts";
import type { BuildingFeature, WorldWarning } from "../../world/model/types.ts";

/** render_height is authoritative when present; otherwise the project policy. */
export function buildingFeatures(
  features: readonly DecodedVectorFeature[],
  projector: GeoProjector,
  tile: SlippyTile,
  extent: number,
  warnings: WorldWarning[],
): BuildingFeature[] {
  const buildings: BuildingFeature[] = [];
  for (const feature of features) {
    if (feature.geometry.type !== "polygon") continue;
    for (const polygon of feature.geometry.polygons) {
      const footprint = decodedPolygonToArea(polygon, projector, tile, extent);
      const featureId = stableTileFeatureId(tile, "building", feature.id, buildings.length);
      if (validatePolygon(footprint).length > 0) { skipWarning(warnings, "invalid-building", "building polygon is not valid", featureId); continue; }
      const renderHeight = typeof feature.properties.render_height === "number" && Number.isFinite(feature.properties.render_height) ? feature.properties.render_height : undefined;
      buildings.push({
        id: featureId,
        kind: "building",
        footprint,
        buildingType: "unknown", // OpenMapTiles does not carry the OpenGTA kind classification
        collisionPolicy: "solid",
        source: { provider: "openfreemap", sourceType: "tile", sourceId: String(feature.id ?? "") },
        tags: {},
        sourceHeightMeters: renderHeight,
      });
    }
  }
  return buildings;
}
