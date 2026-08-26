import type { Polygon2D, Vec2 } from "../model/types.ts";

/** Narrowest carriageway the compiler will emit: alleys must stay part of the network. */
export const MIN_CARRIAGEWAY_METERS = 2;
const CLEARANCE_METERS = 0.3;
const SAMPLE_STEP_METERS = 2;
const PROBE_STEP_METERS = 0.25;
const CELL_METERS = 25;

interface IndexedFootprint {
  readonly polygon: Polygon2D;
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface FootprintIndex {
  readonly cells: ReadonlyMap<string, readonly IndexedFootprint[]>;
}

const cellKey = (x: number, y: number): string => `${Math.floor(x / CELL_METERS)}:${Math.floor(y / CELL_METERS)}`;

export function createFootprintIndex(polygons: readonly Polygon2D[]): FootprintIndex {
  const cells = new Map<string, IndexedFootprint[]>();
  for (const polygon of polygons) {
    if (polygon.outer.length < 3) continue;
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (const point of polygon.outer) {
      minX = Math.min(minX, point.x); minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y);
    }
    const footprint: IndexedFootprint = { polygon, minX, minY, maxX, maxY };
    for (let x = Math.floor(minX / CELL_METERS); x <= Math.floor(maxX / CELL_METERS); x += 1)
      for (let y = Math.floor(minY / CELL_METERS); y <= Math.floor(maxY / CELL_METERS); y += 1) {
        const key = `${x}:${y}`;
        const bucket = cells.get(key);
        if (bucket) bucket.push(footprint); else cells.set(key, [footprint]);
      }
  }
  return { cells };
}

function ringContains(ring: readonly Vec2[], point: Vec2): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i]; const b = ring[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < a.x + (b.x - a.x) * (point.y - a.y) / (b.y - a.y)) inside = !inside;
  }
  return inside;
}

export function isBuiltUp(index: FootprintIndex, point: Vec2): boolean {
  const bucket = index.cells.get(cellKey(point.x, point.y));
  if (!bucket) return false;
  for (const footprint of bucket) {
    if (point.x < footprint.minX || point.x > footprint.maxX || point.y < footprint.minY || point.y > footprint.maxY) continue;
    if (!ringContains(footprint.polygon.outer, point)) continue;
    if (footprint.polygon.holes.some((hole) => ringContains(hole, point))) continue;
    return true;
  }
  return false;
}

/** Distance to the first footprint along `direction`, or Infinity when the probe stays clear. */
function freeDistance(index: FootprintIndex, from: Vec2, direction: Vec2, limitMeters: number): number {
  for (let distance = PROBE_STEP_METERS; distance <= limitMeters; distance += PROBE_STEP_METERS) {
    if (isBuiltUp(index, { x: from.x + direction.x * distance, y: from.y + direction.y * distance })) return distance - PROBE_STEP_METERS;
  }
  return Infinity;
}

/**
 * Measured on the Lecce fixture: the median gap leaves 19% of the network
 * painted inside the buildings that line it, because open stretches outvote the
 * pinch points; the lower quartile brings that down to 13% while collapsing
 * only 5 of 355 roads to the minimum carriageway.
 */
const FIT_PERCENTILE = 0.25;

function percentile(values: readonly number[], ratio: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)))];
}

/**
 * Real OSM footprints often sit closer than the class fallback width, so a
 * nominal carriageway would be painted inside the buildings that line it. The
 * compiler keeps the footprints authoritative and narrows the road instead.
 */
export function fitCarriagewayMeters(centerline: readonly Vec2[], declaredMeters: number, index: FootprintIndex): number {
  if (centerline.length < 2 || !Number.isFinite(declaredMeters) || declaredMeters <= 0) return declaredMeters;
  const limit = declaredMeters / 2;
  const widths: number[] = [];
  for (let segment = 1; segment < centerline.length; segment += 1) {
    const a = centerline[segment - 1]; const b = centerline[segment];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (!length) continue;
    const normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
    const steps = Math.max(1, Math.round(length / SAMPLE_STEP_METERS));
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      const left = freeDistance(index, point, normal, limit);
      const right = freeDistance(index, point, { x: -normal.x, y: -normal.y }, limit);
      widths.push(Math.min(declaredMeters, left + right - CLEARANCE_METERS));
    }
  }
  if (widths.length === 0) return declaredMeters;
  return Math.min(declaredMeters, Math.max(MIN_CARRIAGEWAY_METERS, percentile(widths, FIT_PERCENTILE)));
}
