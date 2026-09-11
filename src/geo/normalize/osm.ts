import type { GeoProjector } from "../coordinates/projector.ts";
import {
  ringArea,
  validatePolygon,
  type BarrierFeature,
  type BuildingFeature,
  type LandAreaFeature,
  type Polygon2D,
  type RoadClass,
  type RoadFeature,
  type Vec2,
  type WaterFeature,
  type WorldRegion,
  type WorldWarning,
} from "../../world/model/types.ts";
import { clipPolygonToBounds, clipPolylineToBounds } from "../../world/model/clip.ts";

export interface RawOsmNode {
  readonly type: "node";
  readonly id: number;
  readonly lat: number;
  readonly lon: number;
  readonly tags?: Record<string, string>;
}

export interface RawOsmWay {
  readonly type: "way";
  readonly id: number;
  readonly nodes: readonly number[];
  readonly tags?: Record<string, string>;
}

export interface RawOsmRelation {
  readonly type: "relation";
  readonly id: number;
  readonly members: readonly {
    readonly type: string;
    readonly ref: number;
    readonly role: string;
  }[];
  readonly tags?: Record<string, string>;
}

export interface RawOsm {
  readonly elements: readonly (RawOsmNode | RawOsmWay | RawOsmRelation)[];
}

const MAX_ELEMENTS = 100_000;
const MAX_WAY_NODES = 20_000;
const MAX_RELATION_MEMBERS = 20_000;
const V0_BOUNDS = { minX: -300, minY: -300, maxX: 300, maxY: 300 } as const;

const roadClasses: Readonly<Record<string, RoadClass>> = {
  motorway: "motorway",
  trunk: "trunk",
  primary: "primary",
  secondary: "secondary",
  tertiary: "tertiary",
  residential: "residential",
  living_street: "residential",
  service: "service",
  pedestrian: "pedestrian",
  footway: "path",
  path: "path",
  cycleway: "path",
};

const buildingTypes: Readonly<Record<string, BuildingFeature["buildingType"]>> = {
  apartments: "residential",
  house: "residential",
  detached: "residential",
  residential: "residential",
  retail: "commercial",
  commercial: "commercial",
  industrial: "industrial",
  warehouse: "industrial",
  civic: "civic",
  public: "civic",
  government: "civic",
  church: "religious",
  cathedral: "religious",
  chapel: "religious",
  mosque: "religious",
  synagogue: "religious",
  temple: "religious",
  garage: "garage",
  garages: "garage",
  shed: "shed",
  roof: "roof",
  mixed_use: "mixed",
};

function warning(
  warnings: WorldWarning[],
  code: string,
  message: string,
  featureId?: string,
): void {
  warnings.push({ code, message, featureId });
}

function tagsOf(tags: Record<string, string> | undefined): Readonly<Record<string, string>> {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return {};
  return Object.fromEntries(
    Object.entries(tags)
      .filter(([key, value]) => key.length <= 256 && typeof value === "string" && value.length <= 4_096)
      .slice(0, 256),
  );
}

function parseMeasure(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const match = raw.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*(m|ft)?$/i);
  if (!match) return undefined;
  const value = Number(match[1]) * (match[2]?.toLowerCase() === "ft" ? 0.3048 : 1);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function parsePositive(raw: string | undefined): number | undefined {
  const value = raw ? Number(raw.trim()) : Number.NaN;
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function parseFinite(raw: string | undefined): number | undefined {
  const value = raw ? Number(raw.trim()) : Number.NaN;
  return Number.isFinite(value) ? value : undefined;
}

function parseBoolean(raw: string | undefined): boolean | undefined {
  if (raw === "yes" || raw === "1" || raw === "true") return true;
  if (raw === "no" || raw === "0" || raw === "false") return false;
  return undefined;
}

function parsedMeasure(
  tags: Readonly<Record<string, string>>,
  key: string,
  warnings: WorldWarning[],
  featureId: string,
): number | undefined {
  const value = parseMeasure(tags[key]);
  if (tags[key] !== undefined && value === undefined) {
    warning(warnings, "invalid-measure", `${key} is not an unambiguous positive measure`, featureId);
  }
  return value;
}

function normalizedRing(points: readonly Vec2[], winding: "outer" | "inner"): Vec2[] | undefined {
  if (points.length < 4) return undefined;
  const first = points[0];
  const last = points.at(-1)!;
  if (first.x !== last.x || first.y !== last.y) return undefined;
  const ring = points.slice(0, -1);
  const polygon = { outer: ring, holes: [] } satisfies Polygon2D;
  if (validatePolygon(polygon).length > 0 || Math.abs(ringArea(ring)) < Number.EPSILON) return undefined;
  const shouldReverse = winding === "outer" ? ringArea(ring) < 0 : ringArea(ring) > 0;
  return shouldReverse ? [...ring].reverse() : [...ring];
}

function closedPolygon(points: readonly Vec2[]): Polygon2D | undefined {
  const outer = normalizedRing(points, "outer");
  return outer ? { outer, holes: [] } : undefined;
}

function pointInRing(point: Vec2, ring: readonly Vec2[]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const a = ring[index];
    const b = ring[previous];
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < a.x + (b.x - a.x) * (point.y - a.y) / (b.y - a.y)) {
      inside = !inside;
    }
  }
  return inside;
}

function joinNodeChains(chain: number[], candidate: readonly number[]): number[] | undefined {
  const first = chain[0];
  const last = chain.at(-1)!;
  const candidateFirst = candidate[0];
  const candidateLast = candidate.at(-1)!;
  if (last === candidateFirst) return [...chain, ...candidate.slice(1)];
  if (last === candidateLast) return [...chain, ...[...candidate].reverse().slice(1)];
  if (first === candidateLast) return [...candidate.slice(0, -1), ...chain];
  if (first === candidateFirst) return [...[...candidate].reverse().slice(0, -1), ...chain];
  return undefined;
}

function assembleNodeRings(
  members: readonly RawOsmRelation["members"][number][],
  waysById: ReadonlyMap<number, RawOsmWay>,
  warnings: WorldWarning[],
  relationId: string,
  role: "outer" | "inner",
  signal?: AbortSignal,
): number[][] {
  const pending: number[][] = [];
  for (const member of members.filter((entry) => entry.type === "way" && entry.role === role)) {
    const way = waysById.get(member.ref);
    if (!way) {
      warning(warnings, "missing-relation-member", `${role} relation member is missing`, relationId);
      continue;
    }
    pending.push([...way.nodes]);
  }

  const rings: number[][] = [];
  while (pending.length > 0) {
    signal?.throwIfAborted();
    let chain = pending.shift()!;
    while (chain.length > 1 && chain[0] !== chain.at(-1)) {
      signal?.throwIfAborted();
      const nextIndex = pending.findIndex((candidate) => joinNodeChains(chain, candidate) !== undefined);
      if (nextIndex < 0) break;
      chain = joinNodeChains(chain, pending.splice(nextIndex, 1)[0])!;
    }
    if (chain.length > 3 && chain[0] === chain.at(-1)) rings.push(chain);
    else warning(warnings, "invalid-multipolygon", `${role} members do not form a closed ring`, relationId);
  }
  return rings;
}

function buildingType(tags: Readonly<Record<string, string>>, buildingTag: string): BuildingFeature["buildingType"] {
  return tags.historic && !buildingTypes[buildingTag]
    ? "historic"
    : (buildingTypes[buildingTag] ?? "unknown");
}

function landClass(tags: Readonly<Record<string, string>>): LandAreaFeature["landClass"] | undefined {
  if (tags.leisure === "park") return "park";
  if (tags.landuse === "grass") return "grass";
  if (tags.landuse === "forest" || tags.natural === "wood") return "forest";
  if (tags.landuse === "industrial") return "industrial";
  if (tags.landuse === "residential") return "residential";
  if (tags.landuse === "commercial" || tags.landuse === "retail") return "commercial";
  if (tags.highway === "pedestrian" && tags.area === "yes") return "pedestrian";
  if (tags.amenity === "parking") return "parking";
  if (tags.natural === "sand") return "sand";
  if (tags.natural === "bare_rock") return "bare";
  return undefined;
}

function barrierPolicy(barrier: string): BarrierFeature["collisionPolicy"] {
  if (["wall", "retaining_wall", "city_wall", "fence", "bollard"].includes(barrier)) return "solid";
  if (barrier === "gate") return "conditional";
  if (barrier === "entrance") return "passable";
  return "unknown";
}

function isValidNode(node: RawOsmNode): boolean {
  return Number.isSafeInteger(node.id)
    && Number.isFinite(node.lat)
    && node.lat >= -90
    && node.lat <= 90
    && Number.isFinite(node.lon)
    && node.lon >= -180
    && node.lon <= 180;
}

function isValidWay(way: RawOsmWay): boolean {
  return Number.isSafeInteger(way.id)
    && Array.isArray(way.nodes)
    && way.nodes.length <= MAX_WAY_NODES
    && way.nodes.every(Number.isSafeInteger);
}

function isValidRelation(relation: RawOsmRelation): boolean {
  return Number.isSafeInteger(relation.id)
    && Array.isArray(relation.members)
    && relation.members.length <= MAX_RELATION_MEMBERS
    && relation.members.every((member) => Number.isSafeInteger(member.ref)
      && typeof member.type === "string"
      && typeof member.role === "string");
}

function addRelationBuildings(
  relation: RawOsmRelation,
  waysById: ReadonlyMap<number, RawOsmWay>,
  nodes: ReadonlyMap<number, RawOsmNode>,
  projector: GeoProjector,
  buildings: BuildingFeature[],
  warnings: WorldWarning[],
  signal?: AbortSignal,
): void {
  const tags = tagsOf(relation.tags);
  const tag = tags.building;
  if (!tag) return;
  const relationId = `osm:relation:${relation.id}`;
  const projectRing = (nodeIds: readonly number[], winding: "outer" | "inner"): Vec2[] | undefined => {
    const points: Vec2[] = [];
    for (const nodeId of nodeIds) {
      const node = nodes.get(nodeId);
      if (!node) {
        warning(warnings, "missing-node", "relation member references a missing node", relationId);
        return undefined;
      }
      points.push(projector.project({ latitude: node.lat, longitude: node.lon }));
    }
    return normalizedRing(points, winding);
  };

  const outerRings = assembleNodeRings(relation.members, waysById, warnings, relationId, "outer", signal)
    .map((ring) => projectRing(ring, "outer"))
    .filter((ring): ring is Vec2[] => ring !== undefined);
  if (outerRings.length === 0) {
    warning(warnings, "missing-relation-member", "building relation has no valid outer ring", relationId);
    return;
  }
  const innerRings = assembleNodeRings(relation.members, waysById, warnings, relationId, "inner", signal)
    .map((ring) => projectRing(ring, "inner"))
    .filter((ring): ring is Vec2[] => ring !== undefined);
  const holesByOuter = outerRings.map(() => [] as Vec2[][]);
  for (const inner of innerRings) {
    const candidates = outerRings
      .map((outer, index) => ({ index, area: Math.abs(ringArea(outer)), contains: pointInRing(inner[0], outer) }))
      .filter((entry) => entry.contains)
      .sort((a, b) => a.area - b.area);
    if (candidates[0]) holesByOuter[candidates[0].index].push(inner);
    else warning(warnings, "orphan-multipolygon-hole", "inner ring is outside every outer ring", relationId);
  }

  outerRings.forEach((outer, index) => {
    const id = outerRings.length === 1 ? relationId : `${relationId}:part:${index}`;
    buildings.push({
      id,
      kind: "building",
      footprint: { outer, holes: holesByOuter[index] },
      buildingType: buildingType(tags, tag),
      source: { provider: "openstreetmap", sourceType: "relation", sourceId: String(relation.id) },
      tags,
      sourceHeightMeters: parsedMeasure(tags, "height", warnings, id),
      sourceLevels: parsePositive(tags["building:levels"]),
      collisionPolicy: tag === "roof" ? "passable" : "solid",
    });
  });
}

export interface NormalizeOptions { readonly signal?: AbortSignal }

export function normalizeOsm(
  raw: RawOsm,
  projector: GeoProjector,
  origin: WorldRegion["geoOrigin"],
  id = "osm-v0",
  options: NormalizeOptions = {},
): WorldRegion {
  if (!raw || !Array.isArray(raw.elements)) throw new TypeError("OSM input must contain an elements array");
  options.signal?.throwIfAborted();
  const warnings: WorldWarning[] = [];
  if (raw.elements.length > MAX_ELEMENTS) {
    warning(warnings, "element-limit", `input was truncated to ${MAX_ELEMENTS} elements`);
  }

  const nodes = new Map<number, RawOsmNode>();
  const ways: RawOsmWay[] = [];
  const relations: RawOsmRelation[] = [];
  let partitionIndex = 0;
  for (const element of raw.elements.slice(0, MAX_ELEMENTS)) {
    if (partitionIndex++ % 256 === 0) options.signal?.throwIfAborted();
    if (element.type === "node") {
      if (isValidNode(element)) nodes.set(element.id, element);
      else warning(warnings, "invalid-node", "node has invalid identity or coordinates", `osm:node:${element.id}`);
    } else if (element.type === "way") {
      if (isValidWay(element)) ways.push(element);
      else warning(warnings, "invalid-way", "way exceeds limits or has invalid references", `osm:way:${element.id}`);
    } else if (element.type === "relation") {
      if (isValidRelation(element)) relations.push(element);
      else warning(warnings, "invalid-relation", "relation exceeds limits or has invalid members", `osm:relation:${element.id}`);
    } else {
      warning(warnings, "invalid-element", "unsupported OSM element type");
    }
  }

  const buildings: BuildingFeature[] = [];
  const roads: RoadFeature[] = [];
  const landAreas: LandAreaFeature[] = [];
  const waterAreas: WaterFeature[] = [];
  const barriers: BarrierFeature[] = [];
  const trees: WorldRegion["trees"][number][] = [];
  const waysById = new Map(ways.map((way) => [way.id, way]));
  const relationBuildingWays = new Set(
    relations
      .filter((relation) => tagsOf(relation.tags).building)
      .flatMap((relation) => relation.members.filter((member) => member.type === "way").map((member) => member.ref)),
  );
  const pointsFor = (way: RawOsmWay): Vec2[] | undefined => {
    const points: Vec2[] = [];
    for (const nodeId of way.nodes) {
      const node = nodes.get(nodeId);
      if (!node) {
        warning(warnings, "missing-node", "way references a missing node", `osm:way:${way.id}`);
        return undefined;
      }
      points.push(projector.project({ latitude: node.lat, longitude: node.lon }));
    }
    return points;
  };

  let wayIndex = 0;
  for (const way of ways) {
    if (wayIndex++ % 64 === 0) options.signal?.throwIfAborted();
    const tags = tagsOf(way.tags);
    const featureId = `osm:way:${way.id}`;
    const points = pointsFor(way);
    if (!points) continue;

    const buildingTag = tags.building;
    if (buildingTag && !relationBuildingWays.has(way.id)) {
      const footprint = closedPolygon(points);
      if (!footprint) warning(warnings, "invalid-building", "building way is not a valid closed polygon", featureId);
      else buildings.push({
        id: featureId,
        kind: "building",
        footprint,
        buildingType: buildingType(tags, buildingTag),
        source: { provider: "openstreetmap", sourceType: "way", sourceId: String(way.id) },
        tags,
        sourceHeightMeters: parsedMeasure(tags, "height", warnings, featureId),
        sourceLevels: parsePositive(tags["building:levels"]),
        collisionPolicy: buildingTag === "roof" ? "passable" : "solid",
      });
    }

    if (tags.highway) {
      const roadClass = tags.highway === "service" && tags.service === "parking_aisle"
        ? "parking-aisle"
        : (roadClasses[tags.highway] ?? "unknown");
      roads.push({
        id: featureId,
        kind: "road",
        centerline: { points },
        roadClass,
        widthMeters: parsedMeasure(tags, "width", warnings, featureId),
        laneCount: parsePositive(tags.lanes),
        oneWay: parseBoolean(tags.oneway),
        surface: tags.surface,
        bridge: parseBoolean(tags.bridge),
        tunnel: parseBoolean(tags.tunnel),
        layerHint: parseFinite(tags.layer),
        source: { provider: "openstreetmap", sourceType: "way", sourceId: String(way.id) },
        tags,
      });
    }

    const mappedLandClass = landClass(tags);
    if (mappedLandClass) {
      const area = closedPolygon(points);
      if (area) landAreas.push({
        id: featureId,
        kind: "land",
        area,
        landClass: mappedLandClass,
        source: { provider: "openstreetmap", sourceType: "way", sourceId: String(way.id) },
        tags,
      });
    }

    if (tags.natural === "water") {
      const area = closedPolygon(points);
      if (area) waterAreas.push({
        id: featureId,
        kind: "water",
        area,
        waterClass: tags.water,
        source: { provider: "openstreetmap", sourceType: "way", sourceId: String(way.id) },
        tags,
      });
    } else if (tags.waterway && points.length >= 2) {
      waterAreas.push({
        id: featureId,
        kind: "water",
        line: { points },
        waterClass: tags.waterway,
        source: { provider: "openstreetmap", sourceType: "way", sourceId: String(way.id) },
        tags,
      });
    }

    if (tags.barrier && points.length >= 2) {
      barriers.push({
        id: featureId,
        kind: "barrier",
        geometry: closedPolygon(points) ?? { points },
        barrierType: tags.barrier,
        collisionPolicy: barrierPolicy(tags.barrier),
        source: { provider: "openstreetmap", sourceType: "way", sourceId: String(way.id) },
        tags,
      });
    }
  }

  for (const relation of relations) {
    addRelationBuildings(relation, waysById, nodes, projector, buildings, warnings, options.signal);
  }

  for (const node of nodes.values()) {
    const tags = tagsOf(node.tags);
    if (tags.natural === "tree") trees.push({
      id: `osm:node:${node.id}`,
      kind: "tree",
      position: projector.project({ latitude: node.lat, longitude: node.lon }),
      source: { provider: "openstreetmap", sourceType: "node", sourceId: String(node.id) },
      tags,
    });
  }

  const clippedBuildings = buildings.flatMap((building) => {
    const footprint = clipPolygonToBounds(building.footprint, V0_BOUNDS);
    return footprint ? [{ ...building, footprint }] : [];
  });
  const clippedRoads = roads.flatMap((road) => {
    const parts = clipPolylineToBounds(road.centerline.points, V0_BOUNDS);
    return parts.map((points, index) => ({
      ...road,
      id: parts.length === 1 ? road.id : `${road.id}:part:${index}`,
      centerline: { points },
    }));
  });
  const clippedLand = landAreas.flatMap((area) => {
    const polygon = clipPolygonToBounds(area.area, V0_BOUNDS);
    return polygon ? [{ ...area, area: polygon }] : [];
  });
  const clippedWater: WaterFeature[] = [];
  for (const water of waterAreas) {
    if (water.area) {
      const area = clipPolygonToBounds(water.area, V0_BOUNDS);
      if (area) clippedWater.push({ ...water, area });
      continue;
    }
    const parts = water.line ? clipPolylineToBounds(water.line.points, V0_BOUNDS) : [];
    parts.forEach((points, index) => clippedWater.push({
        ...water,
        id: parts.length === 1 ? water.id : `${water.id}:part:${index}`,
        line: { points },
      }));
  }
  const clippedBarriers: BarrierFeature[] = [];
  for (const barrier of barriers) {
    if ("outer" in barrier.geometry) {
      const geometry = clipPolygonToBounds(barrier.geometry, V0_BOUNDS);
      if (geometry) clippedBarriers.push({ ...barrier, geometry });
      continue;
    }
    const parts = clipPolylineToBounds(barrier.geometry.points, V0_BOUNDS);
    parts.forEach((points, index) => clippedBarriers.push({
        ...barrier,
        id: parts.length === 1 ? barrier.id : `${barrier.id}:part:${index}`,
        geometry: { points },
      }));
  }
  const clippedTrees = trees.filter((tree) => tree.position.x >= V0_BOUNDS.minX
    && tree.position.x <= V0_BOUNDS.maxX
    && tree.position.y >= V0_BOUNDS.minY
    && tree.position.y <= V0_BOUNDS.maxY);

  return {
    id,
    geoOrigin: origin,
    bounds: V0_BOUNDS,
    buildings: clippedBuildings,
    roads: clippedRoads,
    landAreas: clippedLand,
    waterAreas: clippedWater,
    barriers: clippedBarriers,
    trees: clippedTrees,
    warnings,
  };
}
