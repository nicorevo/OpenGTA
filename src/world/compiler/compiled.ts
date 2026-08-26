import type { Bounds2D, Polygon2D, Vec2, WorldRegion } from "../model/types.ts";
import { MIN_CARRIAGEWAY_METERS, createFootprintIndex, fitCarriagewayMeters } from "./road-fit.ts";

export type CollisionShape2D =
  | { readonly kind: "polygon"; readonly featureId: string; readonly polygon: Polygon2D }
  | { readonly kind: "segment"; readonly featureId: string; readonly a: Vec2; readonly b: Vec2; readonly thicknessMeters?: number }
  | { readonly kind: "circle"; readonly featureId: string; readonly center: Vec2; readonly radiusMeters: number };
export interface CompiledLabel { readonly featureId: string; readonly text: string; readonly position: Vec2; readonly angle: number; readonly kind: "road" | "place"; readonly priority: number; }
export interface CompiledChunkV0 { readonly schemaVersion: 0; readonly id: string; readonly spatial: { readonly regionId: string; readonly bounds: Bounds2D; readonly originOffset: Vec2 }; readonly ground: readonly { readonly featureId: string; readonly area: Polygon2D; readonly styleKey: string }[]; readonly roads: readonly { readonly featureId: string; readonly surface: Polygon2D; readonly centerline: readonly Vec2[]; readonly widthMeters: number; readonly styleKey: string }[]; readonly buildings: readonly { readonly featureId: string; readonly roof: Polygon2D; readonly visualHeightMeters: number; readonly styleKey: string; readonly fakeDepth: { readonly enabled: boolean; readonly scale: number } }[]; readonly labels: readonly CompiledLabel[]; readonly collisions: readonly CollisionShape2D[]; readonly featureIndex: Readonly<Record<string, { readonly kind: string }>>; readonly diagnostics: CompileDiagnostics; }
export interface CompileDiagnostics { readonly inputFeatureCount: number; readonly compiledFeatureCount: number; readonly skippedFeatureCount: number; readonly warnings: readonly string[]; readonly stageDurationsMs: Readonly<Record<string, number>>; }
export interface CompileResult { readonly chunks: readonly CompiledChunkV0[]; readonly diagnostics: CompileDiagnostics; }

const widths: Record<string, number> = { motorway: 12, trunk: 10, primary: 9, secondary: 8, tertiary: 7, residential: 6, service: 4, pedestrian: 4, path: 2, "parking-aisle": 3.5, unknown: 5 };
const polygon = (outer: readonly Vec2[]): Polygon2D => ({ outer, holes: [] });
const JOIN_EPSILON_METERS = 1e-9;
function roadSurface(points: readonly Vec2[], width: number): Polygon2D | undefined {
  if (points.length < 2 || !Number.isFinite(width) || width <= 0) return undefined;
  const half = width / 2;
  const normals: Vec2[] = []; const vertices: Vec2[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]; const b = points[i + 1]; const dx = b.x - a.x; const dy = b.y - a.y; const length = Math.hypot(dx, dy);
    if (!length) continue;
    normals.push({ x: -dy / length * half, y: dx / length * half });
    if (vertices.length === 0) vertices.push(a);
    vertices.push(b);
  }
  if (normals.length === 0) return undefined;
  const left: Vec2[] = []; const right: Vec2[] = [];
  for (let i = 0; i < vertices.length; i += 1) {
    const vertex = vertices[i];
    const before = normals[Math.max(0, i - 1)];
    const after = normals[Math.min(i, normals.length - 1)];
    left.push({ x: vertex.x + before.x, y: vertex.y + before.y });
    right.push({ x: vertex.x - before.x, y: vertex.y - before.y });
    if (Math.hypot(after.x - before.x, after.y - before.y) > JOIN_EPSILON_METERS) {
      left.push({ x: vertex.x + after.x, y: vertex.y + after.y });
      right.push({ x: vertex.x - after.x, y: vertex.y - after.y });
    }
  }
  if (left.length < 2) return undefined;
  return polygon([...left, ...right.reverse()]);
}
function midpoint(points: readonly Vec2[]): { position: Vec2; angle: number } | undefined { if (points.length < 2) return undefined; let total = 0; for (let i = 1; i < points.length; i += 1) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y); if (total === 0) return undefined; let distance = total / 2; for (let i = 1; i < points.length; i += 1) { const a = points[i - 1]; const b = points[i]; const length = Math.hypot(b.x - a.x, b.y - a.y); if (distance <= length) return { position: { x: a.x + (b.x - a.x) * distance / length, y: a.y + (b.y - a.y) * distance / length }, angle: Math.atan2(b.y - a.y, b.x - a.x) }; distance -= length; } return undefined; }

export function compileRegion(region: WorldRegion): CompileResult {
  const roads: Array<CompiledChunkV0["roads"][number]> = []; const buildings: Array<CompiledChunkV0["buildings"][number]> = []; const ground: Array<CompiledChunkV0["ground"][number]> = []; const labels: CompiledLabel[] = [];
  const collisions: CollisionShape2D[] = []; const featureIndex: Record<string, { kind: string }> = {}; const warnings: string[] = [];
  for (const area of region.landAreas) { ground.push({ featureId: area.id, area: area.area, styleKey: `land:${area.landClass}` }); featureIndex[area.id] = { kind: area.kind }; }
  for (const water of region.waterAreas) { if (water.area) { ground.push({ featureId: water.id, area: water.area, styleKey: `water:${water.waterClass ?? "generic"}` }); featureIndex[water.id] = { kind: water.kind }; } }
  const footprints = createFootprintIndex(region.buildings.map((building) => building.footprint));
  let narrowedToMinimum = 0;
  for (const road of region.roads) {
    const declared = road.widthMeters ?? (road.laneCount ? road.laneCount * 3 : widths[road.roadClass]);
    const points = road.centerline.points;
    const width = fitCarriagewayMeters(points, declared, footprints);
    if (width <= MIN_CARRIAGEWAY_METERS && declared > MIN_CARRIAGEWAY_METERS) narrowedToMinimum += 1;
    const surface = roadSurface(points, width);
    if (!surface) { warnings.push(`road ${road.id} could not produce a surface`); continue; }
    roads.push({ featureId: road.id, surface, centerline: points, widthMeters: width, styleKey: `road:${road.roadClass}` }); featureIndex[road.id] = { kind: road.kind }; const name = road.tags?.name; const labelPosition = name ? midpoint(road.centerline.points) : undefined; if (name && labelPosition) labels.push({ featureId: road.id, text: name, position: labelPosition.position, angle: labelPosition.angle, kind: "road", priority: ({ motorway: 100, trunk: 95, primary: 90, secondary: 85, tertiary: 75, residential: 60, pedestrian: 55, service: 40, path: 30, "parking-aisle": 20, unknown: 10 })[road.roadClass] });
  }
  for (const building of region.buildings) {
    const height = building.sourceHeightMeters ?? (building.sourceLevels ? building.sourceLevels * 3 : 9);
    buildings.push({ featureId: building.id, roof: building.footprint, visualHeightMeters: height, styleKey: `building:${building.buildingType}`, fakeDepth: { enabled: true, scale: Math.min(1, height / 12) } });
    featureIndex[building.id] = { kind: building.kind }; const name = building.tags?.name; if (name) labels.push({ featureId: building.id, text: name, position: building.footprint.outer.reduce((sum, point) => ({ x: sum.x + point.x / building.footprint.outer.length, y: sum.y + point.y / building.footprint.outer.length }), { x: 0, y: 0 }), angle: 0, kind: "place", priority: 110 });
    if (building.collisionPolicy === "unknown") warnings.push(`building ${building.id} has unknown collision policy; defaulted to solid`);
    if (building.collisionPolicy !== "passable") collisions.push({ kind: "polygon", featureId: building.id, polygon: building.footprint });
  }
  let compiledBarrierCount = 0;
  for (const barrier of region.barriers) {
    if (barrier.collisionPolicy !== "solid") continue;
    if ("outer" in barrier.geometry) collisions.push({ kind: "polygon", featureId: barrier.id, polygon: barrier.geometry });
    else for (let index = 1; index < barrier.geometry.points.length; index += 1) collisions.push({ kind: "segment", featureId: barrier.id, a: barrier.geometry.points[index - 1], b: barrier.geometry.points[index] });
    featureIndex[barrier.id] = { kind: barrier.kind };
    compiledBarrierCount += 1;
  }
  if (narrowedToMinimum > 0) warnings.push(`${narrowedToMinimum} roads were narrowed to the minimum carriageway because buildings cover their centerline`);
  const inputFeatureCount = region.buildings.length + region.roads.length + region.landAreas.length + region.waterAreas.length + region.barriers.length + region.trees.length;
  const compiledFeatureCount = ground.length + roads.length + buildings.length + compiledBarrierCount;
  const skippedFeatureCount = Math.max(0, inputFeatureCount - compiledFeatureCount);
  if (skippedFeatureCount > 0) warnings.push(`${skippedFeatureCount} input features are not compiled by the V0 profile`);
  const diagnostics: CompileDiagnostics = { inputFeatureCount, compiledFeatureCount, skippedFeatureCount, warnings, stageDurationsMs: { total: 0 } };
  for (const area of region.landAreas) { const name = area.tags?.name; if (name) labels.push({ featureId: area.id, text: name, position: area.area.outer.reduce((sum, point) => ({ x: sum.x + point.x / area.area.outer.length, y: sum.y + point.y / area.area.outer.length }), { x: 0, y: 0 }), angle: 0, kind: "place", priority: 105 }); }
  labels.sort((a, b) => b.priority - a.priority || a.text.localeCompare(b.text));
  const chunk: CompiledChunkV0 = { schemaVersion: 0, id: `${region.id}:chunk:0`, spatial: { regionId: region.id, bounds: region.bounds, originOffset: { x: 0, y: 0 } }, ground, roads, buildings, labels, collisions, featureIndex, diagnostics };
  return { chunks: [chunk], diagnostics };
}
