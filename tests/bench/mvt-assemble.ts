import type { DecodedVectorTile } from "../../src/geo/mvt/decode.ts";
import { createTangentProjector } from "../../src/geo/coordinates/projector.ts";
import { transportationRoadFeatures } from "../../src/geo/normalize/mvt-roads.ts";
import { buildingFeatures } from "../../src/geo/normalize/mvt-buildings.ts";
import { landAndWaterFeatures } from "../../src/geo/normalize/mvt-land.ts";
import { clipPolygonToBounds, clipPolylineToBounds } from "../../src/world/model/clip.ts";
import { validatePolygon, type Bounds2D, type RoadFeature, type WorldRegion, type WorldWarning } from "../../src/world/model/types.ts";

/** Shared Sant'Oronzo bench origin and pinned z14 tile. */
export const ORIGIN = { latitude: 40.35316888888889, longitude: 18.17259 };
export const TILE = { z: 14, x: 9019, y: 6181 };
export const EXTENT = 4096;
export const V0_BOUNDS: Bounds2D = { minX: -300, minY: -300, maxX: 300, maxY: 300 };

/** Clip a mapped MVT road set to the canonical V0 box exactly like normalizeOsm does for OSM. */
function clipRoads(roads: readonly RoadFeature[], bounds: Bounds2D): RoadFeature[] {
  const clipped: RoadFeature[] = [];
  for (const road of roads) {
    for (const points of clipPolylineToBounds(road.centerline.points, bounds)) {
      if (points.length < 2) continue;
      clipped.push({ ...road, id: `${road.id}#p${clipped.length}`, centerline: { points } });
    }
  }
  return clipped;
}

/** Build a WorldRegion from the decoded tile, clipped to the canonical V0 box. */
export function mvtToRegion(decoded: DecodedVectorTile): { region: WorldRegion; warnings: WorldWarning[]; raw: { roads: number; buildings: number; land: number; water: number } } {
  const projector = createTangentProjector(ORIGIN);
  const warnings: WorldWarning[] = [];
  const layerFeatures = (name: string) => decoded.layers.find((layer) => layer.name === name)?.features ?? [];
  const rawRoads = transportationRoadFeatures(layerFeatures("transportation"), projector, TILE, EXTENT, warnings);
  const rawBuildings = buildingFeatures(layerFeatures("building"), projector, TILE, EXTENT, warnings);
  const { landAreas: rawLand, waterAreas: rawWater } = landAndWaterFeatures(
    [...layerFeatures("park"), ...layerFeatures("landuse"), ...layerFeatures("landcover"), ...layerFeatures("water")],
    projector, TILE, EXTENT, warnings,
  );
  const buildings = rawBuildings
    .map((building) => ({ ...building, footprint: clipPolygonToBounds(building.footprint, V0_BOUNDS) }))
    .filter((building) => building.footprint !== undefined && validatePolygon(building.footprint).length === 0)
    .map((building) => ({ ...building, footprint: building.footprint! }));
  const landAreas = rawLand
    .map((area) => ({ ...area, area: clipPolygonToBounds(area.area, V0_BOUNDS) }))
    .filter((area) => area.area !== undefined && validatePolygon(area.area).length === 0)
    .map((area) => ({ ...area, area: area.area! }));
  const waterAreas = rawWater
    .map((area) => ({ ...area, area: area.area !== undefined ? clipPolygonToBounds(area.area, V0_BOUNDS) : undefined }))
    .filter((area) => area.area !== undefined && validatePolygon(area.area).length === 0)
    .map((area) => ({ ...area, area: area.area! }));
  const roads = clipRoads(rawRoads, V0_BOUNDS);
  const region: WorldRegion = {
    id: "mvt-z14",
    geoOrigin: ORIGIN,
    bounds: V0_BOUNDS,
    buildings,
    roads,
    landAreas,
    waterAreas,
    barriers: [], // gap: OpenMapTiles z14 carries no barrier layer usable by OpenGTA
    trees: [],    // gap: no tree/amenity layer mapped in the PoC
    warnings,
  };
  return { region, warnings, raw: { roads: rawRoads.length, buildings: rawBuildings.length, land: rawLand.length, water: rawWater.length } };
}
