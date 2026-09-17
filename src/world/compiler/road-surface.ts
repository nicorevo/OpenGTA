import type { Polygon2D, Vec2 } from "../model/types.ts";

const polygon = (outer: readonly Vec2[]): Polygon2D => ({ outer, holes: [] });
const JOIN_EPSILON_METERS = 1e-9;

/**
 * The fillable road surface (ribbon) around a centerline: the centerline
 * offset by half the width on both sides, with mitered joins where the
 * direction changes. Returns undefined when no ribbon can be built.
 */
export function roadSurface(points: readonly Vec2[], width: number): Polygon2D | undefined {
  if (points.length < 2 || !Number.isFinite(width) || width <= 0) return undefined;
  const half = width / 2;
  const normals: Vec2[] = [];
  const vertices: Vec2[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (!length) continue;
    normals.push({ x: (-dy / length) * half, y: (dx / length) * half });
    if (vertices.length === 0) vertices.push(a);
    vertices.push(b);
  }
  if (normals.length === 0) return undefined;
  const left: Vec2[] = [];
  const right: Vec2[] = [];
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
