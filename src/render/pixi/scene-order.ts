export interface StrokeableRoad {
  readonly widthMeters: number;
}

export interface PaintableBuilding {
  readonly featureId: string;
  readonly roof: { readonly outer: readonly { readonly x: number; readonly y: number }[] };
}

export interface RoadStrokeGroup<T extends StrokeableRoad> {
  readonly widthMeters: number;
  readonly roads: readonly T[];
}

/**
 * Roads sharing a width are stroked as a single path so junctions merge instead
 * of showing the outline of every individual segment quad.
 */
export function groupRoadsByWidth<T extends StrokeableRoad>(roads: readonly T[]): RoadStrokeGroup<T>[] {
  const groups = new Map<number, T[]>();
  for (const road of roads) {
    if (!Number.isFinite(road.widthMeters) || road.widthMeters <= 0) continue;
    const group = groups.get(road.widthMeters);
    if (group) group.push(road);
    else groups.set(road.widthMeters, [road]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([widthMeters, group]) => ({ widthMeters, roads: group }));
}

/**
 * The fake-2.5D facade is extruded toward north-west, so a building must be
 * painted after the neighbour lying in that direction: the neighbour's roof then
 * hides the shared wall instead of leaving a dark band across the block.
 */
export function sortBuildingsForPainter<T extends PaintableBuilding>(buildings: readonly T[]): T[] {
  return [...buildings].sort((a, b) => depthKey(a) - depthKey(b) || a.featureId.localeCompare(b.featureId));
}

function depthKey(building: PaintableBuilding): number {
  const points = building.roof.outer;
  if (points.length === 0) return 0;
  let sum = 0;
  for (const point of points) sum += point.y - point.x;
  return sum / points.length;
}
