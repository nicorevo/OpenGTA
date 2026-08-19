export interface Vec2 { readonly x: number; readonly y: number; }
export interface Bounds2D { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number; }
export interface Polyline2D { readonly points: readonly Vec2[]; }
export interface Polygon2D { readonly outer: readonly Vec2[]; readonly holes: readonly (readonly Vec2[])[]; }
export interface SourceRef { readonly provider: string; readonly sourceType?: string; readonly sourceId?: string; readonly revision?: string; }
export interface FeatureBase { readonly id: string; readonly source?: SourceRef; readonly tags?: Readonly<Record<string, string>>; }
export type BuildingType = "residential" | "commercial" | "industrial" | "civic" | "religious" | "historic" | "garage" | "shed" | "roof" | "mixed" | "unknown";
export type RoadClass = "motorway" | "trunk" | "primary" | "secondary" | "tertiary" | "residential" | "service" | "pedestrian" | "path" | "parking-aisle" | "unknown";
export type LandClass = "grass" | "park" | "forest" | "industrial" | "residential" | "commercial" | "pedestrian" | "parking" | "sand" | "bare" | "generic" | "unknown";
export interface BuildingFeature extends FeatureBase { readonly kind: "building"; readonly footprint: Polygon2D; readonly buildingType: BuildingType; readonly sourceHeightMeters?: number; readonly sourceLevels?: number; readonly materialHint?: string; readonly roofTypeHint?: string; readonly collisionPolicy: "solid" | "passable" | "unknown"; }
export interface RoadFeature extends FeatureBase { readonly kind: "road"; readonly centerline: Polyline2D; readonly roadClass: RoadClass; readonly widthMeters?: number; readonly laneCount?: number; readonly oneWay?: boolean; readonly surface?: string; readonly bridge?: boolean; readonly tunnel?: boolean; readonly layerHint?: number; }
export interface LandAreaFeature extends FeatureBase { readonly kind: "land"; readonly area: Polygon2D; readonly landClass: LandClass; }
export interface WaterFeature extends FeatureBase { readonly kind: "water"; readonly area?: Polygon2D; readonly line?: Polyline2D; readonly waterClass?: string; }
export interface BarrierFeature extends FeatureBase { readonly kind: "barrier"; readonly geometry: Polyline2D | Polygon2D; readonly barrierType?: string; readonly collisionPolicy: "solid" | "passable" | "conditional" | "unknown"; }
export interface TreeFeature extends FeatureBase { readonly kind: "tree"; readonly position: Vec2; readonly trunkRadiusMeters?: number; readonly canopyRadiusMeters?: number; }
export interface WorldWarning { readonly code: string; readonly message: string; readonly featureId?: string; }
export interface WorldRegion { readonly id: string; readonly geoOrigin: { readonly latitude: number; readonly longitude: number }; readonly bounds: Bounds2D; readonly buildings: readonly BuildingFeature[]; readonly roads: readonly RoadFeature[]; readonly landAreas: readonly LandAreaFeature[]; readonly waterAreas: readonly WaterFeature[]; readonly barriers: readonly BarrierFeature[]; readonly trees: readonly TreeFeature[]; readonly warnings: readonly WorldWarning[]; }

export function ringArea(ring: readonly Vec2[]): number { let area = 0; for (let i = 0; i < ring.length; i += 1) { const a = ring[i]; const b = ring[(i + 1) % ring.length]; area += a.x * b.y - b.x * a.y; } return area / 2; }
export function validatePolygon(polygon: Polygon2D): string[] { const errors: string[] = []; for (const ring of [polygon.outer, ...polygon.holes]) { if (ring.length < 3) errors.push("ring has fewer than three vertices"); if (ring.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) errors.push("ring contains non-finite coordinates"); if (new Set(ring.map((point) => `${point.x},${point.y}`)).size < 3) errors.push("ring has fewer than three unique vertices"); } return errors; }
