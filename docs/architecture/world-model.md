# OpenGTA Web — Canonical World Model

**Status:** Architecture design baseline  
**Date:** 2026-08-19  
**Depends on:**  
- `product-architecture-principles.md`  
- `dual-world-pipeline.md`  
- `2d-rendering-model.md`  

**Purpose:** Define the renderer-independent, physics-independent, 2D-first canonical representation of the geographic world that sits between source-data normalization and runtime compilation.

---

## 1. Role of the Canonical World Model

The Canonical World Model is the stable internal representation of the world after geographic source data has been normalized and before renderer-specific or physics-specific compilation.

Conceptually:

```text
Raw geographic data
        ↓
GeoDataSource
        ↓
Normalization
        ↓
CANONICAL WORLD MODEL
        ↓
World Compiler
        ↓
CompiledChunk / runtime data
```

Its purpose is to prevent direct coupling between:

- OpenStreetMap or other source formats;
- rendering technology;
- physics technology;
- cache/serialization format;
- gameplay implementation.

The Canonical World Model represents **what exists in the world**, not how a particular library renders or simulates it.

---

## 2. Core invariants

The following rules are mandatory.

### 2.1 2D-first

All authoritative geometry is primarily represented in two dimensions.

```text
position = X/Y local planar coordinates
```

A technical renderer may later map these coordinates to X/Z or another internal system.

### 2.2 Renderer independence

The world model must not contain:

- sprites;
- GPU buffers;
- meshes;
- textures;
- materials;
- renderer scene nodes;
- Three.js objects;
- Pixi objects;
- WebGL/WebGPU handles.

### 2.3 Physics independence

The world model must not contain:

- rigid bodies;
- collider handles;
- joints;
- physics-engine vectors;
- Rapier objects;
- Box2D objects;
- engine-specific collision data.

It may contain semantic information from which collision geometry can later be compiled.

### 2.4 Source independence

The world model must not assume that all data comes from OpenStreetMap.

Source-specific tags may be preserved as metadata, but the primary semantic representation must be stable.

### 2.5 Deterministic semantics

Given equivalent normalized source data, the world model should be reproducible where practical.

### 2.6 Stable identity

Every feature that may need debugging, caching, updating or gameplay reference must have a stable identifier within the relevant world/source scope.

---

## 3. World hierarchy

The conceptual hierarchy is:

```text
WorldRegion
├── metadata
├── coordinate reference
├── buildings[]
├── roads[]
├── landAreas[]
├── waterAreas[]
├── barriers[]
├── transportFeatures[]
├── staticObjects[]
└── source metadata
```

This document defines the logical entities.

It does not define the final chunking or persistence format.

---

## 4. Coordinate domains

The architecture must distinguish at least four coordinate domains:

```text
1. Geographic coordinates
   latitude / longitude

2. Local world coordinates
   planar units relative to a local origin

3. Compiled/render coordinates
   renderer/runtime-specific

4. Screen coordinates
   pixels
```

The Canonical World Model should primarily use **local world coordinates**.

Geographic coordinates should be retained as metadata or origin information where useful.

---

## 5. Geographic origin

Each loaded/normalized region needs an explicit geographic origin.

Conceptual structure:

```ts
interface GeoOrigin {
    latitude: number;
    longitude: number;
}
```

This represents the geographic anchor from which local planar coordinates are derived.

The exact projection mathematics are intentionally deferred to a dedicated coordinate-system document/ADR.

---

## 6. Local coordinates

Canonical local geometry should use simple planar points.

Conceptually:

```ts
interface Vec2 {
    x: number;
    y: number;
}
```

The unit should ultimately be defined by the coordinate-system decision.

Preferred direction:

```text
1 local unit ≈ 1 meter
```

but this is not accepted until the coordinate-system design is finalized.

---

## 7. Primitive geometry types

The Canonical World Model requires a small set of neutral geometry primitives.

### 7.1 Point

```ts
type Point2D = Vec2;
```

### 7.2 Polyline

```ts
interface Polyline2D {
    points: Vec2[];
}
```

Requirements:

- at least two points;
- preserves meaningful source ordering;
- need not be closed.

Typical use:

- road centerlines;
- barriers;
- rail lines;
- linear features.

### 7.3 Polygon

```ts
interface Polygon2D {
    outer: Vec2[];
    holes?: Vec2[][];
}
```

Requirements:

- closed logically;
- at least three unique points;
- may contain holes;
- orientation convention should be normalized later.

Typical use:

- buildings;
- water;
- land use;
- plazas;
- parking areas.

### 7.4 Bounds

```ts
interface Bounds2D {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}
```

Bounds may be derived rather than persisted in every feature.

---

## 8. Feature identity

Every canonical feature should expose a stable logical ID.

Conceptually:

```ts
type FeatureId = string;
```

A canonical ID may be based on:

- source provider;
- source object type;
- source object ID;
- normalized relation identity;
- generated deterministic ID for synthetic features.

Example:

```text
osm:way:123456
osm:relation:98765
generated:road-surface:abc123
```

The exact ID format is not yet fixed.

The important requirement is stability and uniqueness within a world dataset.

---

## 9. Source provenance

Each feature may preserve source provenance.

Conceptually:

```ts
interface SourceRef {
    provider: string;
    sourceType?: string;
    sourceId?: string;
    revision?: string;
}
```

Purpose:

- debugging;
- source comparison;
- update invalidation;
- attribution;
- support tooling.

Source metadata must not become a dependency for runtime rendering.

---

## 10. Common feature metadata

A common base may contain:

```ts
interface WorldFeatureBase {
    id: FeatureId;
    source?: SourceRef;
    tags?: Record<string, string>;
}
```

`tags` should be considered raw or near-raw semantic metadata preserved for:

- style rules;
- debugging;
- later enrichment;
- feature-specific interpretation.

Core gameplay/runtime logic should prefer normalized semantic fields over repeatedly interpreting raw tags.

---

## 11. BuildingFeature

Buildings are one of the most important canonical feature types.

Conceptually:

```ts
interface BuildingFeature extends WorldFeatureBase {
    kind: "building";

    footprint: Polygon2D;

    buildingType?: BuildingType;

    sourceHeightMeters?: number;
    sourceLevels?: number;

    visualHints?: {
        preferredHeightClass?: string;
        roofType?: string;
        materialHint?: string;
    };

    collisionPolicy?: "solid" | "passable" | "unknown";
}
```

This is conceptual, not final code.

### 11.1 Authoritative building data

The authoritative part is:

```text
building exists
+
building footprint
+
semantic building type where known
```

### 11.2 Non-authoritative visual data

The following are visual hints:

- facade style;
- roof appearance;
- visual height;
- color;
- shadow;
- fake-depth direction.

### 11.3 Building height

If source height exists, preserve it.

If source levels exist, preserve them separately.

Do not immediately collapse:

```text
height
levels
visual height
```

into one renderer-specific number.

---

## 12. BuildingType

A normalized building category may be useful.

Possible early categories:

```text
residential
commercial
industrial
civic
religious
historic
garage
shed
mixed
unknown
```

The exact taxonomy is not fixed.

The taxonomy should remain intentionally coarse in early versions.

Avoid creating a huge ontology before a concrete rendering/gameplay requirement exists.

---

## 13. RoadFeature

Roads should remain semantically richer than rendered polygons.

Conceptually:

```ts
interface RoadFeature extends WorldFeatureBase {
    kind: "road";

    centerline: Polyline2D;

    roadClass?: RoadClass;

    widthMeters?: number;
    laneCount?: number;

    oneWay?: boolean;

    surface?: string;

    access?: RoadAccess;

    bridge?: boolean;
    tunnel?: boolean;

    layerHint?: number;
}
```

The road surface polygon should generally be produced later by the compiler.

### Why centerline first?

Because the same centerline can later feed:

- road rendering;
- driving surface;
- traffic routing;
- navigation graph;
- lane generation;
- AI;
- road markings.

The canonical model should therefore preserve the semantic source line rather than only the final visual polygon.

---

## 14. RoadClass

Possible coarse normalization:

```text
motorway
trunk
primary
secondary
tertiary
residential
service
pedestrian
path
parking-aisle
unknown
```

Exact mapping belongs to source normalization.

The renderer should not need to interpret raw `highway=*` tags directly.

---

## 15. Road access semantics

Possible initial concept:

```ts
type RoadAccess =
    | "vehicle"
    | "pedestrian"
    | "mixed"
    | "restricted"
    | "unknown";
```

This may later affect:

- vehicle navigation;
- pedestrian navigation;
- spawn rules;
- gameplay restrictions.

---

## 16. LandAreaFeature

Generic land areas should be represented as polygons.

Conceptually:

```ts
interface LandAreaFeature extends WorldFeatureBase {
    kind: "land";

    area: Polygon2D;

    landClass: LandClass;
}
```

Possible classes:

```text
grass
park
forest
industrial
residential
commercial
pedestrian
parking
sand
bare
generic
unknown
```

The taxonomy should remain coarse until visual/gameplay needs justify expansion.

---

## 17. WaterFeature

Water should be explicit.

Conceptually:

```ts
interface WaterFeature extends WorldFeatureBase {
    kind: "water";

    area?: Polygon2D;
    line?: Polyline2D;

    waterClass?: string;
}
```

Possible forms:

- river polygon;
- river centerline;
- canal;
- lake;
- pond;
- coastline-adjacent area.

The compiler may later turn linear water features into visible widths.

---

## 18. BarrierFeature

Barriers are important because they may affect collision independently from buildings.

Conceptually:

```ts
interface BarrierFeature extends WorldFeatureBase {
    kind: "barrier";

    geometry: Polyline2D | Polygon2D;

    barrierType?: string;

    collisionPolicy?: "solid" | "passable" | "conditional" | "unknown";
}
```

Examples:

- walls;
- fences;
- gates;
- bollards;
- retaining walls.

---

## 19. StaticObjectFeature

Small geographic objects may eventually be represented as point features.

Conceptually:

```ts
interface StaticObjectFeature extends WorldFeatureBase {
    kind: "static-object";

    position: Vec2;

    objectType: string;

    orientationRadians?: number;

    collisionPolicy?: "none" | "point" | "small-solid" | "unknown";
}
```

Possible uses:

- lamp posts;
- hydrants;
- signs;
- trees;
- benches;
- kiosks.

Do not attempt to include every possible OSM node in the first model.

Only normalize categories that have rendering or gameplay value.

---

## 20. Tree representation

Trees deserve special treatment because their visual canopy and collision shape differ.

Possible semantic form:

```ts
interface TreeFeature extends WorldFeatureBase {
    kind: "tree";

    position: Vec2;

    trunkRadiusMeters?: number;
    canopyRadiusMeters?: number;
}
```

The renderer may create:

```text
small trunk/base collision
+
large canopy visual
```

without changing the canonical position.

---

## 21. TransportFeature

Some transport features may not fit roads directly.

Potential later examples:

- railways;
- tram lines;
- ferry paths;
- platforms;
- stations.

These should remain optional until required.

Avoid designing a complete transport ontology during the first vertical slice.

---

## 22. Areas and overlaps

Geographic data can contain overlapping semantics.

Example:

```text
landuse=residential
    overlaps
building footprints
    overlaps
parking
```

The Canonical World Model must allow overlaps.

Do not attempt to flatten all semantics into one non-overlapping map layer.

Rendering/compilation will resolve visual priority later.

---

## 23. Layer semantics

Source data may contain bridge/tunnel/layer information.

The canonical model should preserve a normalized relative layer hint where meaningful.

Conceptually:

```ts
layerHint?: number;
```

This may help distinguish:

- bridge road over road;
- tunnel below ground;
- stacked infrastructure.

However, early gameplay may deliberately simplify vertical topology.

The model should preserve useful information even if the first renderer ignores it.

---

## 24. Elevation

Terrain elevation is outside the first technical validation.

The canonical model may later include optional elevation metadata.

For now:

```text
world gameplay plane = flat
```

unless a later product decision changes this.

Do not introduce 3D terrain merely because external elevation data exists.

---

## 25. Semantic vs derived geometry

A key distinction:

### Semantic geometry

Represents source/world truth.

Examples:

```text
building footprint
road centerline
water polygon
wall line
```

### Derived geometry

Produced by the compiler.

Examples:

```text
road surface polygon
building fake facade
shadow polygon
collision simplification
render batch
navigation lanes
```

Derived geometry should not be inserted back into the canonical model as if it were source truth.

---

## 26. Collision semantics

The Canonical World Model should provide enough semantic information to compile collision later.

Possible policies:

```text
solid
passable
conditional
unknown
none
```

Collision geometry itself belongs primarily to `CompiledChunk`.

Examples:

```text
BuildingFeature footprint
    ↓ compiler
simplified collision polygon

BarrierFeature line
    ↓ compiler
collision segment/thickened polygon
```

---

## 27. Visual semantics

The model may preserve renderer-neutral visual hints.

Examples:

```text
materialHint
roofType
historic flag
region/style category
surface class
```

Avoid storing:

```text
texture filename
GPU material index
shader name
sprite atlas coordinates
```

Those belong to later compiled/render layers.

---

## 28. WorldRegion

A normalized working area can be represented conceptually as:

```ts
interface WorldRegion {
    id: string;

    origin: GeoOrigin;
    bounds: Bounds2D;

    buildings: BuildingFeature[];
    roads: RoadFeature[];
    landAreas: LandAreaFeature[];
    waterAreas: WaterFeature[];
    barriers: BarrierFeature[];
    staticObjects: StaticObjectFeature[];

    metadata: WorldRegionMetadata;
}
```

This is an in-memory logical container.

It is not necessarily the final persistent format.

---

## 29. WorldRegion metadata

Possible metadata:

```ts
interface WorldRegionMetadata {
    sourceProviders: string[];

    createdAt?: string;

    sourceRevision?: string;

    normalizationVersion?: string;

    warnings?: WorldWarning[];
}
```

The exact fields are not fixed.

---

## 30. Validation warnings

Normalization should preserve non-fatal warnings.

Examples:

```text
open polygon repaired
invalid ring skipped
missing road width
unknown building type
unsupported relation
duplicate source feature
```

Conceptually:

```ts
interface WorldWarning {
    code: string;
    featureId?: string;
    message: string;
}
```

Warnings should help debugging without making imperfect real-world data unusable.

---

## 31. Unknown values

Unknown data must remain explicit.

Prefer:

```text
buildingType = "unknown"
```

over inventing certainty.

Fallbacks may be applied later by the compiler/style system.

The Canonical World Model should distinguish:

```text
unknown source value
```

from:

```text
compiler fallback chosen later
```

---

## 32. Missing data strategy

Real geographic data is incomplete.

The canonical model must support partial features.

Examples:

- building without height;
- road without width;
- unknown surface;
- tree without canopy size.

Missing visual attributes should not invalidate otherwise usable geometry.

---

## 33. Geometry validity

Normalization should establish minimum geometric invariants before data enters the world model.

Examples:

### Polygon

- valid outer ring;
- finite coordinates;
- no duplicate-only rings;
- meaningful area;
- holes contained where practical.

### Polyline

- at least two distinct points;
- finite coordinates.

The exact repair strategy belongs to normalization.

The canonical model should receive already-normalized geometry where possible.

---

## 34. Polygon complexity

Canonical polygons should preserve meaningful shape.

Do not aggressively simplify them at normalization time merely for rendering performance.

Simplification belongs to the compiler/LOD stage.

Why:

- different clients may need different simplification;
- offline packages can afford better processing;
- gameplay may later require source detail;
- debugging benefits from preserving normalized truth.

---

## 35. Courtyards and holes

Building holes/courtyards must be representable.

Example:

```text
outer building ring
████████████
██        ██
██  hole  ██
██        ██
████████████
```

The renderer/physics compiler may later decide how accurately to support them by quality tier.

The canonical model should not discard them prematurely.

---

## 36. Multipolygons

Complex geographic relations may normalize into:

```text
one feature
+
multiple polygons
```

Two possible canonical approaches:

### A

```ts
MultiPolygon2D
```

### B

Split into multiple deterministic component features linked by a common parent/source.

No final choice is made here.

The normalization design should choose the simplest approach that preserves identity and semantics.

---

## 37. World partitioning

The Canonical World Model should not hard-code final runtime chunk dimensions.

A working region may later be partitioned by the World Compiler.

```text
WorldRegion
     ↓
spatial partition
     ↓
CompiledChunk[]
```

This keeps chunk-size experimentation out of source normalization.

---

## 38. Spatial indexes

Spatial indexes belong primarily to compiled/runtime data.

The canonical model may use temporary indexes internally for processing, but they are not part of world truth.

Possible later indexes:

- uniform grid;
- quadtree;
- R-tree;
- spatial hash.

No selection is made here.

---

## 39. Stable ordering

Feature arrays should not be relied upon as semantic ordering.

If deterministic build output requires stable ordering, the compiler may sort by:

```text
feature type
feature ID
spatial key
```

Do not encode rendering order implicitly through source-array position.

---

## 40. Mutability

The first implementation should prefer treating normalized canonical features as immutable once created.

Benefits:

- reproducible compilation;
- easier caching;
- easier debugging;
- safer worker transfer;
- simpler tests.

Runtime gameplay state belongs elsewhere.

---

## 41. Static world vs dynamic world

The Canonical World Model primarily describes **static geographic world truth**.

Dynamic runtime entities should live in a separate gameplay/runtime model.

Examples of dynamic data that do not belong here:

- player position;
- current vehicle velocity;
- NPC state;
- damage;
- mission state;
- temporary debris;
- multiplayer avatars.

The geographic model may provide spawn/semantic hints later, but does not own live entity state.

---

## 42. Runtime entity model separation

Preferred architecture:

```text
CANONICAL WORLD
static geographic truth

COMPILED WORLD
runtime-ready static data

ENTITY WORLD
players / vehicles / NPCs / gameplay
```

This separation prevents OpenStreetMap-derived data from becoming an all-purpose game object model.

---

## 43. Gameplay references

Gameplay systems may need to reference geographic features.

For example:

```text
mission target = building feature ID
road closure = road feature ID
spawn zone = land feature ID
```

Stable feature IDs therefore matter beyond rendering.

---

## 44. Style resolution

The Canonical World Model may expose enough semantic metadata for a separate style resolver.

Example:

```text
BuildingFeature
- type: historic
- materialHint: stone
- source tags
- region context
        ↓
Style Resolver
        ↓
Visual Style Descriptor
```

The style descriptor belongs downstream.

---

## 45. Regional context

Some visual decisions depend on geographic context rather than individual OSM tags.

A normalized region may therefore expose context such as:

```text
country code
region
city
climate/style profile
```

These should be considered metadata, not authoritative geometry.

Exact geocoding/context enrichment is not defined here.

---

## 46. Source tag preservation policy

Do not blindly discard all source tags after normalization.

Recommended direction:

### Keep

- tags needed for unresolved semantics;
- tags useful for visual styling;
- tags useful for debugging;
- tags likely to become gameplay-relevant.

### Normalize explicitly

- common road class;
- one-way;
- building type;
- height/levels;
- water/land category;
- barrier semantics.

### Potentially discard later

- irrelevant source metadata proven unnecessary.

Memory impact should be measured before choosing an aggressive policy.

---

## 47. Type safety

The implementation should prefer explicit discriminated feature types.

Conceptual union:

```ts
type WorldFeature =
    | BuildingFeature
    | RoadFeature
    | LandAreaFeature
    | WaterFeature
    | BarrierFeature
    | StaticObjectFeature;
```

This helps Codex and human developers avoid feature-type ambiguity.

---

## 48. Schema evolution

The in-memory model will evolve.

Important rules:

- avoid premature public/stable API promises;
- keep versioned serialization separate from internal type evolution;
- update architecture docs when semantics change;
- avoid storing renderer-specific convenience fields that become hard to remove.

---

## 49. Testing strategy

Canonical model tests should focus on semantics and invariants.

### Unit tests

Examples:

```text
valid building footprint accepted
invalid polygon rejected/reported
road preserves centerline ordering
missing height remains undefined
unknown type remains unknown
source ID preserved
holes preserved
```

### Fixture tests

Use known small OSM-derived fixtures with expected normalized output.

### Snapshot/golden tests

Potentially useful for deterministic normalized structures, but should avoid brittle formatting dependence.

---

## 50. Debug serialization

During early development it may be useful to serialize the Canonical World Model to readable JSON for inspection.

This is a debugging convenience only.

It must not automatically become the final world-package format.

---

## 51. Memory considerations

The canonical model should remain reasonably compact but prioritize correctness before premature compression.

Potential later optimizations:

- typed arrays;
- coordinate deduplication;
- string/tag interning;
- shared metadata tables;
- binary representation.

These belong to compiled/persistent formats unless profiling proves canonical memory to be a bottleneck.

---

## 52. Worker transfer

The model should be designed with background processing in mind.

Potential concerns:

- structured clone cost;
- transferables;
- typed arrays;
- large nested objects.

The first implementation may use simple objects for clarity.

Optimization should follow measurement.

---

## 53. Relationship to CompiledChunk

The distinction must remain clear.

### Canonical model

```text
semantic
source-aware
renderer-neutral
physics-neutral
preserves useful detail
```

### CompiledChunk

```text
runtime-optimized
partitioned
possibly simplified
possibly batched
collision-prepared
render-ready metadata
cache/serialization oriented
```

The compiler is the explicit boundary between them.

---

## 54. Example end-to-end building

Source:

```text
OSM building polygon
building=apartments
building:levels=4
```

Normalization:

```text
closed valid polygon
normalized local coordinates
normalized type=residential
levels=4
```

Canonical:

```text
BuildingFeature
- footprint
- buildingType=residential
- sourceLevels=4
```

Compilation:

```text
render roof polygon
fake facade metadata
collision polygon
style category
batch assignment
```

Runtime:

```text
renderer draws
physics blocks vehicle
```

At no stage does the canonical feature need a 3D mesh.

---

## 55. Example end-to-end road

Source:

```text
OSM way
highway=residential
surface=asphalt
```

Normalization:

```text
valid local polyline
roadClass=residential
surface=asphalt
```

Canonical:

```text
RoadFeature
- centerline
- roadClass
- surface
```

Compilation:

```text
derive road width
generate road polygon
generate visual batch
optional driving/navigation metadata
```

Runtime:

```text
renderer draws surface
vehicle uses planar world
```

---

## 56. First implementation subset

The first vertical slice does not need every feature type.

Minimum recommended canonical subset:

```text
WorldRegion
GeoOrigin
Bounds2D
Vec2
Polyline2D
Polygon2D

BuildingFeature
RoadFeature
LandAreaFeature
WaterFeature
```

Optional if fixture requires them:

```text
BarrierFeature
StaticObjectFeature
```

Do not implement unused taxonomy merely because this document lists future concepts.

---

## 57. Codex implementation guidance

When Codex implements the canonical model:

1. Keep types small and explicit.
2. Do not import renderer libraries into the world-model module.
3. Do not import physics libraries into the world-model module.
4. Do not parse raw OSM directly inside rendering code.
5. Preserve stable feature IDs.
6. Preserve polygon holes when normalization provides them.
7. Preserve unknown/missing values explicitly.
8. Do not invent visual defaults in the canonical layer.
9. Do not generate road surface polygons here.
10. Do not generate fake building facades here.
11. Keep static geographic data separate from dynamic gameplay state.
12. Prefer immutable data after normalization.
13. Add tests for invariants before optimization.
14. Report any source feature that cannot be represented without extending the model.

---

## 58. Proposed module boundary

A possible repository direction:

```text
src/
├── geo/
│   ├── source/
│   ├── normalize/
│   └── coordinates/
│
├── world/
│   ├── model/
│   │   ├── geometry.ts
│   │   ├── features.ts
│   │   ├── world-region.ts
│   │   └── metadata.ts
│   │
│   └── compiler/
│
├── render/
├── physics/
└── gameplay/
```

This is a suggested boundary, not a required exact directory layout.

Codex should first inspect the actual repository before creating folders.

---

## 59. Open questions

Still unresolved:

- exact local coordinate projection;
- exact local coordinate unit;
- polygon winding convention;
- multipolygon representation;
- final normalized taxonomy;
- source-tag retention policy;
- bridge/tunnel vertical semantics;
- whether road width belongs in normalized data or later derivation;
- how synthetic/generated canonical features receive IDs;
- whether geographic origin belongs per region or per compiled chunk;
- canonical use of typed arrays versus object structures;
- handling of very large polygons crossing future chunk boundaries;
- source update reconciliation;
- relation between building parts and whole buildings.

These require focused follow-up documents or ADRs.

---

## 60. Decision summary

Accepted by this document:

- Canonical World Model exists as a mandatory architecture boundary.
- It is 2D-first.
- It is renderer-independent.
- It is physics-independent.
- It is source-provider-independent.
- Stable feature identity is required.
- Building footprints are authoritative.
- Roads preserve semantic centerlines.
- Visual and collision geometry are primarily derived downstream.
- Missing data remains explicit.
- Dynamic gameplay state is separate.
- World Compiler owns runtime-oriented derivation and partitioning.

Not accepted by this document:

- exact TypeScript interfaces;
- exact coordinate projection;
- final feature taxonomy;
- multipolygon implementation;
- final persistent schema;
- final source-tag retention policy;
- final chunk model;
- final renderer;
- final physics engine.
