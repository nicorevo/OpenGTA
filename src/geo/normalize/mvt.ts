import { createTangentProjector, type GeoProjector } from "../coordinates/projector.ts";
import type { DecodedVectorTile } from "../mvt/decode.ts";
import { tileBounds, type SlippyTile } from "../mvt/math.ts";
import { transportationRoadFeatures } from "./mvt-roads.ts";
import { buildingFeatures } from "./mvt-buildings.ts";
import { landAndWaterFeatures } from "./mvt-land.ts";
import { clipPolygonToBounds, clipPolylineToBounds } from "../../world/model/clip.ts";
import { validatePolygon, type Bounds2D, type RoadFeature, type Vec2, type WorldRegion, type WorldWarning } from "../../world/model/types.ts";

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

/** Merged-line tolerance: parts of the same feature clipped at a tile seam rejoin within this distance. */
const SEAM_MERGE_EPSILON_METERS = 0.75;

function intersectBounds(a: Bounds2D, b: Bounds2D): Bounds2D | undefined {
  const minX = Math.max(a.minX, b.minX);
  const minY = Math.max(a.minY, b.minY);
  const maxX = Math.min(a.maxX, b.maxX);
  const maxY = Math.min(a.maxY, b.maxY);
  if (maxX <= minX || maxY <= minY) return undefined;
  return { minX, minY, maxX, maxY };
}

/** The tile's own geographic area projected on the region plane (no buffer). */
function tileOwnBounds(tile: SlippyTile, projector: GeoProjector): Bounds2D {
  const geo = tileBounds(tile.z, tile.x, tile.y);
  const northWest = projector.project({ latitude: geo.north, longitude: geo.west });
  const southEast = projector.project({ latitude: geo.south, longitude: geo.east });
  return { minX: northWest.x, minY: southEast.y, maxX: southEast.x, maxY: northWest.y };
}

/**
 * Join parts of the same source feature that were clipped at a tile seam:
 * matching endpoints within the merge epsilon collapse into one chain, so a
 * road crossing the seam stays a single continuous centerline. Deterministic:
 * parts arrive in tile order and each chain grows by the first match.
 */
function mergeRoadParts(parts: readonly RoadFeature[], featureKey: string): RoadFeature[] {
  const pool = parts.map((part) => [...part.centerline.points]);
  const chains: Vec2[][] = [];
  while (pool.length > 0) {
    const chain = pool.shift()!;
    let extended = true;
    while (extended) {
      extended = false;
      for (let index = 0; index < pool.length; index += 1) {
        const candidate = pool[index];
        const head = chain[0];
        const tail = chain[chain.length - 1];
        const candidateStart = candidate[0];
        const candidateEnd = candidate[candidate.length - 1];
        const joined: Vec2[] | undefined =
          Math.hypot(tail.x - candidateStart.x, tail.y - candidateStart.y) < SEAM_MERGE_EPSILON_METERS ? [...chain, ...candidate.slice(1)]
          : Math.hypot(tail.x - candidateEnd.x, tail.y - candidateEnd.y) < SEAM_MERGE_EPSILON_METERS ? [...chain, ...[...candidate].reverse().slice(1)]
          : Math.hypot(head.x - candidateEnd.x, head.y - candidateEnd.y) < SEAM_MERGE_EPSILON_METERS ? [...candidate.slice(0, -1), ...chain]
          : Math.hypot(head.x - candidateStart.x, head.y - candidateStart.y) < SEAM_MERGE_EPSILON_METERS ? [...[...candidate].reverse().slice(0, -1), ...chain]
          : undefined;
        if (joined) { chain.splice(0, chain.length, ...joined); pool.splice(index, 1); extended = true; break; }
      }
    }
    chains.push(chain);
  }
  const template = parts[0];
  return chains.map((points, index) => ({ ...template, id: `${featureKey}#p${index}`, centerline: { points } }));
}

/**
 * Decoded MVT tiles -> WorldRegion on the tangent plane of the region
 * origin. Each tile contributes only its own area (buffer strips are
 * clipped away, which drops the neighbor's buffered copies), then the
 * geometry is clipped to the canonical V0 box. Features of the same source
 * identity are deduplicated at the seam: roads merge into continuous
 * centerlines, polygons keep disjoint halves with canonical ids. Barriers
 * and trees are intentionally empty: OpenMapTiles z14 carries no usable
 * barrier layer and the PoC maps no tree/amenity layer (declared gaps,
 * see DATA-09).
 */
export function normalizeMvtTiles(options: NormalizeMvtOptions): NormalizedMvtRegion {
  const projector = createTangentProjector(options.origin);
  const warnings: WorldWarning[] = [];
  const buildings = [];
  const landAreas = [];
  const waterAreas = [];
  const roadParts: RoadFeature[] = [];
  const raw = { roads: 0, buildings: 0, land: 0, water: 0 };
  for (const { tile, decoded } of options.tiles) {
    const clipBox = intersectBounds(tileOwnBounds(tile, projector), MVT_REGION_BOUNDS);
    const layerFeatures = (name: string) => decoded.layers.find((layer) => layer.name === name)?.features ?? [];
    // OpenMapTiles keeps road names in the separate transportation_name
    // layer keyed by the same OSM id: join them here, never invent them.
    const roadNames = new Map<number, string>();
    for (const feature of layerFeatures("transportation_name")) {
      const name = typeof feature.properties.name === "string" && feature.properties.name.length > 0 ? feature.properties.name : undefined;
      if (name !== undefined && feature.id !== undefined) roadNames.set(feature.id, name);
    }
    const rawRoads = transportationRoadFeatures(layerFeatures("transportation"), projector, tile, 4096, warnings);
    const rawBuildings = buildingFeatures(layerFeatures("building"), projector, tile, 4096, warnings);
    const { landAreas: rawLand, waterAreas: rawWater } = landAndWaterFeatures(
      [...layerFeatures("park"), ...layerFeatures("landuse"), ...layerFeatures("landcover"), ...layerFeatures("water")],
      projector, tile, 4096, warnings,
    );
    raw.roads += rawRoads.length; raw.buildings += rawBuildings.length; raw.land += rawLand.length; raw.water += rawWater.length;
    if (!clipBox) continue; // this tile contributes nothing inside the region box
    for (const road of rawRoads) {
      const sourceId = Number(road.source?.sourceId);
      const name = Number.isFinite(sourceId) ? roadNames.get(sourceId) : undefined;
      const tags = name ? { name } : road.tags;
      for (const points of clipPolylineToBounds(road.centerline.points, clipBox)) {
        if (points.length < 2) continue;
        roadParts.push({ ...road, tags, centerline: { points } });
      }
    }
    const canonicalId = (layer: string, sourceId: string | undefined, index: number, suffix: string) =>
      sourceId ? `mvt:${layer}:${sourceId}${suffix}${index}` : `mvt:${layer}:i${index}`;
    for (const building of rawBuildings) {
      const footprint = clipPolygonToBounds(building.footprint, clipBox);
      if (!footprint || validatePolygon(footprint).length > 0) continue;
      buildings.push({ ...building, id: canonicalId("building", building.source?.sourceId, buildings.length, "#h"), footprint });
    }
    for (const area of rawLand) {
      const clipped = clipPolygonToBounds(area.area, clipBox);
      if (!clipped || validatePolygon(clipped).length > 0) continue;
      landAreas.push({ ...area, id: canonicalId("land", area.source?.sourceId, landAreas.length, "#a"), area: clipped });
    }
    for (const area of rawWater) {
      const clipped = area.area !== undefined ? clipPolygonToBounds(area.area, clipBox) : undefined;
      if (!clipped || validatePolygon(clipped).length > 0) continue;
      waterAreas.push({ ...area, id: canonicalId("water", area.source?.sourceId, waterAreas.length, "#w"), area: clipped });
    }
  }
  const groups = new Map<string, RoadFeature[]>();
  for (const part of roadParts) {
    const sourceId = part.source?.sourceId;
    const key = sourceId ? `mvt:transportation:${sourceId}` : `tile-scoped:${part.id}`;
    groups.set(key, [...(groups.get(key) ?? []), part]);
  }
  const roads: RoadFeature[] = [];
  for (const [key, parts] of groups) {
    roads.push(...(key.startsWith("tile-scoped:") ? parts : mergeRoadParts(parts, key)));
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
