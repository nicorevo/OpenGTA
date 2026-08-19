# Canonical World V0 — Semantic Contract

**Status:** Normative V0 contract

Field names are recommended. Codex may adapt mechanical naming to repository
standards but must preserve semantics.

## Geometry

```ts
type FeatureId = string;

interface Vec2 {
  readonly x: number;
  readonly y: number;
}

interface Bounds2D {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

interface Polyline2D {
  readonly points: readonly Vec2[];
}

interface Polygon2D {
  readonly outer: readonly Vec2[];
  readonly holes: readonly (readonly Vec2[])[];
}
```

Canonical polygon convention for V0:

- ring closing point is not duplicated in the stored array;
- outer ring normalized counter-clockwise in canonical +X east / +Y north;
- holes normalized clockwise;
- finite coordinates only;
- at least 3 unique vertices per ring.

## Source identity

```ts
interface SourceRef {
  readonly provider: string;
  readonly sourceType?: string;
  readonly sourceId?: string;
  readonly revision?: string;
}

interface FeatureBase {
  readonly id: FeatureId;
  readonly source?: SourceRef;
  readonly tags?: Readonly<Record<string, string>>;
}
```

## Buildings

```ts
type BuildingType =
  | "residential"
  | "commercial"
  | "industrial"
  | "civic"
  | "religious"
  | "historic"
  | "garage"
  | "shed"
  | "roof"
  | "mixed"
  | "unknown";

interface BuildingFeature extends FeatureBase {
  readonly kind: "building";
  readonly footprint: Polygon2D;
  readonly buildingType: BuildingType;
  readonly sourceHeightMeters?: number;
  readonly sourceLevels?: number;
  readonly materialHint?: string;
  readonly roofTypeHint?: string;
  readonly collisionPolicy: "solid" | "passable" | "unknown";
}
```

V0 rule:

- ordinary buildings: `solid`;
- `building=roof`: `passable` unless another source feature indicates a wall;
- malformed/unknown policy: `unknown`, compiler may default to solid only with
  diagnostic.

## Roads

```ts
type RoadClass =
  | "motorway"
  | "trunk"
  | "primary"
  | "secondary"
  | "tertiary"
  | "residential"
  | "service"
  | "pedestrian"
  | "path"
  | "parking-aisle"
  | "unknown";

interface RoadFeature extends FeatureBase {
  readonly kind: "road";
  readonly centerline: Polyline2D;
  readonly roadClass: RoadClass;
  readonly widthMeters?: number;
  readonly laneCount?: number;
  readonly oneWay?: boolean;
  readonly surface?: string;
  readonly bridge?: boolean;
  readonly tunnel?: boolean;
  readonly layerHint?: number;
}
```

Road surface polygon is **not** canonical truth; it is compiler output.

## Land

```ts
type LandClass =
  | "grass"
  | "park"
  | "forest"
  | "industrial"
  | "residential"
  | "commercial"
  | "pedestrian"
  | "parking"
  | "sand"
  | "bare"
  | "generic"
  | "unknown";

interface LandAreaFeature extends FeatureBase {
  readonly kind: "land";
  readonly area: Polygon2D;
  readonly landClass: LandClass;
}
```

## Water

```ts
interface WaterFeature extends FeatureBase {
  readonly kind: "water";
  readonly area?: Polygon2D;
  readonly line?: Polyline2D;
  readonly waterClass?: string;
}
```

## Barriers

```ts
interface BarrierFeature extends FeatureBase {
  readonly kind: "barrier";
  readonly geometry: Polyline2D | Polygon2D;
  readonly barrierType?: string;
  readonly collisionPolicy: "solid" | "passable" | "conditional" | "unknown";
}
```

## Trees/static point objects

Trees are optional in the first visible V0 but allowed in the normalized model:

```ts
interface TreeFeature extends FeatureBase {
  readonly kind: "tree";
  readonly position: Vec2;
  readonly trunkRadiusMeters?: number;
  readonly canopyRadiusMeters?: number;
}
```

## Region

```ts
interface WorldRegion {
  readonly id: string;
  readonly geoOrigin: {
    readonly latitude: number;
    readonly longitude: number;
  };
  readonly bounds: Bounds2D;

  readonly buildings: readonly BuildingFeature[];
  readonly roads: readonly RoadFeature[];
  readonly landAreas: readonly LandAreaFeature[];
  readonly waterAreas: readonly WaterFeature[];
  readonly barriers: readonly BarrierFeature[];
  readonly trees: readonly TreeFeature[];

  readonly warnings: readonly WorldWarning[];
}
```

## Dynamic state exclusion

Do not put here:

- player;
- vehicle velocity;
- NPC state;
- input;
- mission state;
- renderer objects;
- physics objects.
