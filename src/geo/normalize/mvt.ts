import { createTangentProjector } from "../coordinates/projector.ts";
import type { DecodedVectorTile } from "../mvt/decode.ts";
import type { SlippyTile } from "../mvt/math.ts";
import { transportationRoadFeatures } from "./mvt-roads.ts";
import { buildingFeatures } from "./mvt-buildings.ts";
import { landAndWaterFeatures } from "./mvt-land.ts";
import { clipPolygonToBounds, clipPolylineToBounds } from "../../world/model/clip.ts";
import { validatePolygon, type Bounds2D, type RoadFeature, type WorldRegion, type WorldWarning } from "../../world/model/types.ts";

/** Public z14 ceiling of the pinned OpenFreeMap dataset. */
export const MVT_TILE_ZOOM = 14;
/** Canonical V0 bounds around the region origin (same box as normalizeOsm). */
export const MVT_REGION_BOUNDS: Bounds2D = { minX: -300, minY: -300, maxX: 300, maxY: 300 };

export interface MvtTileInput {
  readonly tile: SlippyTile;
  readonly decoded: DecodedVectorTile;
}

export interface NormalizeMvtOptions {
  readonly tiles: readonly MvtTileInput[];
  readonly origin: { readonly latitude: number; readonly longitude: number };
  readonly regionId: string;
}

export interface NormalizedMvtRegion {
  readonly region: WorldRegion;
  readonly raw: { readonly roads: number; readonly buildings: number; readonly land: number; readonly water: number };
}

/** Clip a mapped MVT road set to the canonical box exactly like normalizeOsm does for OSM. */
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

/**
 * Decoded MVT tiles -> WorldRegion on the tangent plane of the region
 * origin, clipped to the canonical V0 box. Feature ids are tile-scoped by
 * the mapping modules, so merging tiles never collides. Barriers and trees
 * are intentionally empty: OpenMapTiles z14 carries no usable barrier layer
 * and the PoC maps no tree/amenity layer (declared gaps, see DATA-09).
 */
export function normalizeMvtTiles(options: NormalizeMvtOptions): NormalizedMvtRegion {
  const projector = createTangentProjector(options.origin);
  const warnings: WorldWarning[] = [];
  const buildings = [];
  const roads = [];
  const landAreas = [];
  const waterAreas = [];
  const raw = { roads: 0, buildings: 0, land: 0, water: 0 };
  for (const { tile, decoded } of options.tiles) {
    const layerFeatures = (name: string) => decoded.layers.find((layer) => layer.name === name)?.features ?? [];
    const rawRoads = transportationRoadFeatures(layerFeatures("transportation"), projector, tile, 4096, warnings);
    const rawBuildings = buildingFeatures(layerFeatures("building"), projector, tile, 4096, warnings);
    const { landAreas: rawLand, waterAreas: rawWater } = landAndWaterFeatures(
      [...layerFeatures("park"), ...layerFeatures("landuse"), ...layerFeatures("landcover"), ...layerFeatures("water")],
      projector, tile, 4096, warnings,
    );
    raw.roads += rawRoads.length; raw.buildings += rawBuildings.length; raw.land += rawLand.length; raw.water += rawWater.length;
    buildings.push(...rawBuildings
      .map((building) => ({ ...building, footprint: clipPolygonToBounds(building.footprint, MVT_REGION_BOUNDS) }))
      .filter((building) => building.footprint !== undefined && validatePolygon(building.footprint).length === 0)
      .map((building) => ({ ...building, footprint: building.footprint! })));
    landAreas.push(...rawLand
      .map((area) => ({ ...area, area: clipPolygonToBounds(area.area, MVT_REGION_BOUNDS) }))
      .filter((area) => area.area !== undefined && validatePolygon(area.area).length === 0)
      .map((area) => ({ ...area, area: area.area! })));
    waterAreas.push(...rawWater
      .map((area) => ({ ...area, area: area.area !== undefined ? clipPolygonToBounds(area.area, MVT_REGION_BOUNDS) : undefined }))
      .filter((area) => area.area !== undefined && validatePolygon(area.area).length === 0)
      .map((area) => ({ ...area, area: area.area! })));
    roads.push(...clipRoads(rawRoads, MVT_REGION_BOUNDS));
  }
  return {
    raw,
    region: {
      id: options.regionId,
      geoOrigin: options.origin,
      bounds: MVT_REGION_BOUNDS,
      buildings,
      roads,
      landAreas,
      waterAreas,
      barriers: [], // gap: no barrier layer at z14
      trees: [],    // gap: no tree/amenity layer in the PoC
      warnings,
    },
  };
}
