import type { GeoProjector } from "../coordinates/projector.ts";
import type { DecodedVectorFeature } from "../mvt/decode.ts";
import type { SlippyTile } from "../mvt/math.ts";
import { skipWarning, stableTileFeatureId, tilePointsToMeters } from "./mvt-common.ts";
import type { RoadFeature, WorldWarning } from "../../world/model/types.ts";

/** OpenMapTiles transportation classes that OpenGTA treats as drivable. */
const DRIVABLE_CLASS: Record<string, RoadFeature["roadClass"]> = {
  motorway: "motorway",
  trunk: "trunk",
  primary: "primary",
  secondary: "secondary",
  tertiary: "tertiary",
  minor: "residential", // PoC mapping: minor != residential is a known approximation
  service: "service",
  track: "unknown",     // drivable fallback, width from the class table
};

/** Never turn pedestrian/rail geometry into a carriageway. */
const NON_DRIVABLE_CLASS = new Set(["path", "footway", "steps", "cycleway", "pedestrian", "rail", "transit", "platform", "ferry", "aerialway", "pier"]);

export function transportationRoadFeatures(
  features: readonly DecodedVectorFeature[],
  projector: GeoProjector,
  tile: SlippyTile,
  extent: number,
  warnings: WorldWarning[],
): RoadFeature[] {
  const roads: RoadFeature[] = [];
  for (const feature of features) {
    const properties = feature.properties;
    const omtClass = typeof properties.class === "string" ? properties.class : "";
    const subclass = typeof properties.subclass === "string" ? properties.subclass : "";
    if (NON_DRIVABLE_CLASS.has(omtClass) || NON_DRIVABLE_CLASS.has(subclass)) continue;
    const roadClass = DRIVABLE_CLASS[omtClass];
    if (!roadClass) { skipWarning(warnings, "unsupported-transportation", `transportation class ${omtClass || "(missing)"} is not mapped`, stableTileFeatureId(tile, "transportation", feature.id, roads.length)); continue; }
    if (feature.geometry.type !== "line") continue; // transportation polygons stay visual-only for the PoC
    for (const line of feature.geometry.lines) {
      const points = tilePointsToMeters(line, projector, tile, extent);
      if (points.length < 2) { skipWarning(warnings, "invalid-road", "road geometry has fewer than two points", stableTileFeatureId(tile, "transportation", feature.id, roads.length)); continue; }
      roads.push({
        id: stableTileFeatureId(tile, "transportation", feature.id, roads.length),
        kind: "road",
        centerline: { points },
        roadClass,
        source: { provider: "openfreemap", sourceType: "tile", sourceId: String(feature.id ?? "") },
        tags: {},
      });
    }
  }
  return roads;
}
