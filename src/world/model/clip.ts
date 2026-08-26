import type { Bounds2D, Polygon2D, Vec2 } from "./types.ts";

type Boundary = { readonly inside: (point: Vec2) => boolean; readonly intersect: (start: Vec2, end: Vec2) => Vec2 };

function clipRing(ring: readonly Vec2[], bounds: Bounds2D): Vec2[] {
  const boundaries: readonly Boundary[] = [
    { inside: (point) => point.x >= bounds.minX, intersect: (a, b) => ({ x: bounds.minX, y: a.y + (b.y - a.y) * (bounds.minX - a.x) / (b.x - a.x) }) },
    { inside: (point) => point.x <= bounds.maxX, intersect: (a, b) => ({ x: bounds.maxX, y: a.y + (b.y - a.y) * (bounds.maxX - a.x) / (b.x - a.x) }) },
    { inside: (point) => point.y >= bounds.minY, intersect: (a, b) => ({ x: a.x + (b.x - a.x) * (bounds.minY - a.y) / (b.y - a.y), y: bounds.minY }) },
    { inside: (point) => point.y <= bounds.maxY, intersect: (a, b) => ({ x: a.x + (b.x - a.x) * (bounds.maxY - a.y) / (b.y - a.y), y: bounds.maxY }) },
  ];
  let output = [...ring];
  for (const boundary of boundaries) {
    if (output.length === 0) break;
    const input = output; output = [];
    let previous = input.at(-1)!; let previousInside = boundary.inside(previous);
    for (const current of input) {
      const currentInside = boundary.inside(current);
      if (currentInside !== previousInside) output.push(boundary.intersect(previous, current));
      if (currentInside) output.push(current);
      previous = current; previousInside = currentInside;
    }
  }
  return output;
}

export function clipPolygonToBounds(polygon: Polygon2D, bounds: Bounds2D): Polygon2D | undefined {
  const outer = clipRing(polygon.outer, bounds);
  if (outer.length < 3) return undefined;
  const holes = polygon.holes.map((hole) => clipRing(hole, bounds)).filter((hole) => hole.length >= 3);
  return { outer, holes };
}

function clipSegment(start: Vec2, end: Vec2, bounds: Bounds2D): [Vec2, Vec2] | undefined {
  let t0 = 0; let t1 = 1; const dx = end.x - start.x; const dy = end.y - start.y;
  for (const [p, q] of [[-dx, start.x - bounds.minX], [dx, bounds.maxX - start.x], [-dy, start.y - bounds.minY], [dy, bounds.maxY - start.y]] as const) {
    if (p === 0) { if (q < 0) return undefined; continue; }
    const ratio = q / p;
    if (p < 0) { if (ratio > t1) return undefined; if (ratio > t0) t0 = ratio; }
    else { if (ratio < t0) return undefined; if (ratio < t1) t1 = ratio; }
  }
  return [{ x: start.x + t0 * dx, y: start.y + t0 * dy }, { x: start.x + t1 * dx, y: start.y + t1 * dy }];
}

export function clipPolylineToBounds(points: readonly Vec2[], bounds: Bounds2D): Vec2[][] {
  const parts: Vec2[][] = [];
  let currentPart: Vec2[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const segment = clipSegment(points[index - 1], points[index], bounds);
    if (!segment) continue;
    const previous = currentPart.at(-1);
    if (previous && (previous.x !== segment[0].x || previous.y !== segment[0].y)) {
      parts.push(currentPart);
      currentPart = [];
    }
    if (currentPart.length === 0) currentPart.push(segment[0]);
    const last = currentPart.at(-1)!;
    if (last.x !== segment[1].x || last.y !== segment[1].y) currentPart.push(segment[1]);
  }
  if (currentPart.length >= 2) parts.push(currentPart);
  return parts;
}
