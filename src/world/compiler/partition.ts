import type { ChunkKey, ChunkGrid } from "../chunk/grid.ts";
import { clipPolygonToBounds, clipPolylineToBounds } from "../model/clip.ts";
import type { Bounds2D, Vec2 } from "../model/types.ts";
import type { CollisionShape2D, CompiledChunkV0 } from "./compiled.ts";
import { roadSurface } from "./road-surface.ts";

function inside(point: Vec2, bounds: Bounds2D): boolean {
  return point.x >= bounds.minX && point.x < bounds.maxX && point.y >= bounds.minY && point.y < bounds.maxY;
}

function fragmentRoad(road: CompiledChunkV0["roads"][number], bounds: Bounds2D): CompiledChunkV0["roads"][number][] {
  // Rebuild the surface from each fragment's own centerline: sharing the
  // way's single clipped surface made every fragment paint the whole way,
  // bridging the notch of U-shaped roads across the cell boundary.
  return clipPolylineToBounds(road.centerline, bounds).flatMap((centerline) => {
    const ribbon = roadSurface(centerline, road.widthMeters);
    const surface = ribbon ? clipPolygonToBounds(ribbon, bounds) : undefined;
    return surface ? [{ ...road, surface, centerline }] : [];
  });
}

function fragmentCollision(collision: CollisionShape2D, bounds: Bounds2D): CollisionShape2D[] {
  if (collision.kind === "polygon") {
    const polygon = clipPolygonToBounds(collision.polygon, bounds);
    return polygon ? [{ ...collision, polygon }] : [];
  }
  if (collision.kind === "circle") return inside(collision.center, bounds) ? [collision] : [];
  return clipPolylineToBounds([collision.a, collision.b], bounds).map((part) => ({ ...collision, a: part[0], b: part[1] }));
}

function translatePoint(point: Vec2, offset: Vec2): Vec2 {
  return { x: point.x + offset.x, y: point.y + offset.y };
}

function translatePolygon(polygon: CompiledChunkV0["ground"][number]["area"], offset: Vec2) {
  return {
    outer: polygon.outer.map((point) => translatePoint(point, offset)),
    holes: polygon.holes.map((hole) => hole.map((point) => translatePoint(point, offset))),
  };
}

export function translateCompiledChunk(chunk: CompiledChunkV0, offset: Vec2): CompiledChunkV0 {
  const translateCollision = (collision: CollisionShape2D): CollisionShape2D => {
    if (collision.kind === "polygon") return { ...collision, polygon: translatePolygon(collision.polygon, offset) };
    if (collision.kind === "circle") return { ...collision, center: translatePoint(collision.center, offset) };
    return { ...collision, a: translatePoint(collision.a, offset), b: translatePoint(collision.b, offset) };
  };
  return {
    ...chunk,
    spatial: {
      ...chunk.spatial,
      bounds: {
        minX: chunk.spatial.bounds.minX + offset.x,
        minY: chunk.spatial.bounds.minY + offset.y,
        maxX: chunk.spatial.bounds.maxX + offset.x,
        maxY: chunk.spatial.bounds.maxY + offset.y,
      },
      originOffset: translatePoint(chunk.spatial.originOffset, offset),
    },
    ground: chunk.ground.map((area) => ({ ...area, area: translatePolygon(area.area, offset) })),
    roads: chunk.roads.map((road) => ({
      ...road,
      surface: translatePolygon(road.surface, offset),
      centerline: road.centerline.map((point) => translatePoint(point, offset)),
    })),
    buildings: chunk.buildings.map((building) => ({ ...building, roof: translatePolygon(building.roof, offset) })),
    labels: chunk.labels.map((label) => ({ ...label, position: translatePoint(label.position, offset) })),
    collisions: chunk.collisions.map(translateCollision),
  };
}

export function ownerKeyForFeature(grid: ChunkGrid, anchor: Vec2): ChunkKey {
  return grid.keyForPoint(anchor);
}

export function partitionCompiledChunk(chunk: CompiledChunkV0, grid: ChunkGrid, keys: readonly ChunkKey[]): readonly CompiledChunkV0[] {
  return keys.map((key) => {
    const bounds = grid.boundsForKey(key);
    const ground = chunk.ground.flatMap((area) => {
      const clipped = clipPolygonToBounds(area.area, bounds);
      return clipped ? [{ ...area, area: clipped }] : [];
    });
    const roads = chunk.roads.flatMap((road) => fragmentRoad(road, bounds));
    const buildings = chunk.buildings.flatMap((building) => {
      const roof = clipPolygonToBounds(building.roof, bounds);
      return roof ? [{ ...building, roof }] : [];
    });
    const labels = chunk.labels.filter((label) => inside(label.position, bounds));
    const collisions = chunk.collisions.flatMap((collision) => fragmentCollision(collision, bounds));
    const featureIndex: Record<string, { readonly kind: string }> = {};
    [...ground, ...roads, ...buildings].forEach((feature) => { featureIndex[feature.featureId] = chunk.featureIndex[feature.featureId] ?? { kind: "unknown" }; });
    return {
      ...chunk,
      id: `${chunk.id}@${grid.idForKey(key)}`,
      spatial: { ...chunk.spatial, bounds },
      ground,
      roads,
      buildings,
      labels,
      collisions,
      featureIndex,
      diagnostics: {
        ...chunk.diagnostics,
        compiledFeatureCount: ground.length + roads.length + buildings.length,
        skippedFeatureCount: 0,
      },
    };
  });
}
