import type { GeoProjector } from "../coordinates/projector.ts";
import type { DecodedVectorFeature } from "../mvt/decode.ts";
import type { SlippyTile } from "../mvt/math.ts";
import { decodedPolygonToArea, skipWarning, stableTileFeatureId } from "./mvt-common.ts";
import { validatePolygon, type LandAreaFeature, type WaterFeature, type WorldWarning } from "../../world/model/types.ts";

const LAND_CLASS: Record<string, LandAreaFeature["landClass"]> = {
  park: "park",
  grass: "grass",
  forest: "forest",
  wood: "forest",
  farmland: "generic",
  sand: "sand",
  residential: "residential",
  commercial: "commercial",
  industrial: "industrial",
  cemetery: "generic",
  pitch: "parking",
  parking: "parking",
  bare: "bare",
  scrub: "generic",
};

export interface MvtLandResult { readonly landAreas: LandAreaFeature[]; readonly waterAreas: WaterFeature[] }

export function landAndWaterFeatures(
  features: readonly DecodedVectorFeature[],
  projector: GeoProjector,
  tile: SlippyTile,
  extent: number,
  warnings: WorldWarning[],
): MvtLandResult {
  const landAreas: LandAreaFeature[] = [];
  const waterAreas: WaterFeature[] = [];
  for (const feature of features) {
    if (feature.geometry.type !== "polygon") continue;
    const layer = feature.layer;
    const waterClass = layer === "water" ? (typeof feature.properties.class === "string" ? feature.properties.class : "water") : undefined;
    const landKey = layer === "park" ? "park" : typeof feature.properties.class === "string" ? feature.properties.class : undefined;
    const name = typeof feature.properties.name === "string" && feature.properties.name.length > 0 ? feature.properties.name : undefined;
    for (const polygon of feature.geometry.polygons) {
      const area = decodedPolygonToArea(polygon, projector, tile, extent);
      const featureId = stableTileFeatureId(tile, layer, feature.id, waterClass ? waterAreas.length : landAreas.length);
      if (validatePolygon(area).length > 0) { skipWarning(warnings, "invalid-area", `${layer} polygon is not valid`, featureId); continue; }
      const tags: Readonly<Record<string, string>> = name ? { name } : {};
      if (waterClass !== undefined) {
        waterAreas.push({ id: featureId, kind: "water", area, waterClass, source: { provider: "openfreemap", sourceType: "tile", sourceId: String(feature.id ?? "") }, tags });
        continue;
      }
      const landClass = landKey ? LAND_CLASS[landKey] : undefined;
      if (!landClass) { skipWarning(warnings, "unsupported-landuse", `${layer} class ${landKey ?? "(missing)"} is not mapped`, featureId); continue; }
      landAreas.push({ id: featureId, kind: "land", area, landClass, source: { provider: "openfreemap", sourceType: "tile", sourceId: String(feature.id ?? "") }, tags });
    }
  }
  return { landAreas, waterAreas };
}
