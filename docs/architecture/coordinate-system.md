# OpenGTA Web — Coordinate System and Spatial Precision

**Status:** Architecture design baseline  
**Date:** 2026-08-19  
**Depends on:**  
- `product-architecture-principles.md`  
- `dual-world-pipeline.md`  
- `2d-rendering-model.md`  
- `world-model.md`  

**Purpose:** Define how OpenGTA Web separates geographic coordinates, canonical local coordinates, runtime coordinates and render-space coordinates while preserving precision across both preprocessed and arbitrary-coordinate open-world modes.

---

## 1. Problem

OpenGTA Web must support two very different spatial situations:

1. a preprocessed area that may be downloaded as a compact static package;
2. an arbitrary geographic coordinate selected by the user and compiled at runtime.

At the same time, the game itself is fundamentally 2D and top-down.

The engine therefore needs a coordinate architecture that:

- accepts real geographic coordinates;
- preserves geographic identity;
- provides local metric-like coordinates for gameplay;
- avoids large world-space values in the renderer;
- works with chunk streaming;
- remains stable when the player travels across many chunks;
- does not force the canonical world model to depend on a renderer;
- does not require full 3D floating-origin machinery.

---

## 2. Core spatial rule

The architecture must distinguish four coordinate domains:

```text
GEOGRAPHIC SPACE
WGS84 latitude / longitude

        ↓ projection / local transform

CANONICAL LOCAL SPACE
2D planar coordinates, preferably meter-like

        ↓ chunk/session placement

RUNTIME SPACE
2D coordinates relative to an active runtime origin

        ↓ renderer adapter

RENDER SPACE
GPU / renderer coordinates near the local origin
```

Screen-space coordinates remain a fifth derived domain:

```text
SCREEN SPACE
pixels
```

No single coordinate representation should be forced to serve all five purposes.

---

## 3. Geographic coordinates are persistent identity

Geographic coordinates remain the stable real-world reference.

Conceptually:

```ts
interface GeoCoordinate {
    latitude: number;
    longitude: number;
}
```

WGS84 latitude/longitude should be treated as persistent metadata for:

- arbitrary-coordinate world loading;
- identifying geographic position;
- reconstructing local coordinates;
- world-package manifests;
- source-data requests;
- cache keys;
- debugging;
- sharing locations;
- future multiplayer/world persistence.

Gameplay and rendering should not operate directly on latitude/longitude.

---

## 4. Canonical gameplay space is planar

Once a geographic area is loaded, the game should work in local planar coordinates.

Preferred semantic interpretation:

```text
x = local east/west axis
y = local north/south axis
```

and ideally:

```text
1 canonical local unit ≈ 1 physical meter
```

This is valuable because it allows:

- intuitive vehicle speed;
- intuitive road widths;
- collision dimensions;
- gameplay distances;
- spatial partitioning;
- debugging;
- consistent tuning.

The exact projection/transformation used to achieve this must remain separate from gameplay code.

---

## 5. Recommended architectural direction

The preferred design is:

```text
WGS84 lat/lon
      ↓
Local metric projection centered on a geographic origin
      ↓
Canonical 2D local coordinates
```

Each working geographic region should have an explicit origin:

```ts
interface GeoOrigin {
    latitude: number;
    longitude: number;
}
```

A normalized feature is then represented by local coordinates relative to that origin.

Example:

```text
Origin:
40.3520 N, 18.1690 E

Building vertex:
x = +137.42 m
y = -82.16 m
```

The renderer never needs to see the original latitude/longitude for routine drawing.

---

## 6. Do not use raw latitude/longitude as XY

The following is prohibited:

```text
x = longitude
y = latitude
```

Reasons:

- degrees are not linear meters;
- longitude scale changes with latitude;
- vehicle velocity becomes meaningless;
- distance calculations become inconsistent;
- chunk dimensions become latitude-dependent;
- physics tuning becomes difficult.

Geographic coordinates must be transformed before entering gameplay space.

---

## 7. Projection candidates

Three broad strategies are relevant.

### 7.1 Web Mercator world meters

Conceptually:

```text
WGS84
  ↓
EPSG:3857-like projected coordinates
  ↓
subtract local origin
```

Advantages:

- common in web mapping;
- simple integration with many map/tile systems;
- global projected coordinate space;
- easy tile addressing.

Disadvantages:

- physical scale distortion increases with latitude;
- projected "meters" are not uniform real ground meters;
- undesirable if gameplay speed/distance should remain geographically meaningful.

Conclusion:

**Useful for map interoperability, but should not automatically become the gameplay metric space.**

---

### 7.2 Local tangent / local metric plane

Conceptually:

```text
WGS84
  ↓
projection centered near current area
  ↓
east/north local meters
```

Advantages:

- intuitive local metric distances;
- excellent fit for city-scale gameplay;
- coordinates remain small;
- good basis for vehicle movement and collision.

Disadvantages:

- valid over a limited spatial neighborhood;
- origin/rebasing strategy is needed for long-distance travel;
- slightly more coordinate-management logic.

Conclusion:

**Preferred architectural direction for gameplay space.**

---

### 7.3 Simple local equirectangular approximation

For relatively small areas, one can approximate:

```text
x ≈ Δlongitude × scale × cos(latitudeOrigin)
y ≈ Δlatitude  × scale
```

Advantages:

- extremely cheap;
- easy to implement;
- sufficient accuracy for small areas.

Disadvantages:

- approximation error increases with distance from origin;
- not suitable as an unbounded global coordinate system.

Conclusion:

**Potentially valid implementation for the first vertical slice, provided the supported radius is explicitly bounded and tested.**

---

## 8. Decision level for the first vertical slice

For the first fixed-area prototype, the coordinate implementation may use a simple local metric projection centered on the fixture.

The first prototype does **not** need:

- global continuous coordinates;
- live origin rebasing;
- cross-city travel;
- world-scale precision handling.

But the API boundary must make later replacement possible.

Conceptually:

```ts
interface GeoProjector {
    toLocal(coord: GeoCoordinate, origin: GeoOrigin): Vec2;
    toGeo(local: Vec2, origin: GeoOrigin): GeoCoordinate;
}
```

The exact API is illustrative.

The important requirement is to isolate projection logic in one module.

---

## 9. Region-local coordinates

The Canonical World Model should store features in coordinates local to a region origin.

Conceptually:

```text
WorldRegion
├── geoOrigin
├── localBounds
├── buildings
├── roads
└── ...
```

This means canonical geometry remains compact:

```text
x = hundreds or thousands of meters
```

rather than:

```text
x = millions of projected world units
```

---

## 10. Chunk coordinates

A compiled chunk should have its own spatial identity.

Conceptually:

```ts
interface ChunkSpatialRef {
    worldRegionId: string;
    chunkId: string;
    localBounds: Bounds2D;
}
```

A chunk may also retain a geographic anchor or derivable geographic bounds for:

- package manifests;
- cache lookup;
- acquisition;
- debugging.

The exact relationship between region origin and chunk origin is not fixed yet.

---

## 11. Recommended two-level placement

A useful future model is:

```text
GEOGRAPHIC ORIGIN
      ↓
REGION-LOCAL COORDINATES
      ↓
CHUNK-LOCAL COORDINATES
      ↓
RUNTIME/RENDER COORDINATES
```

For example:

```text
Region feature:
x = 8420.3 m
y = 5610.8 m

Chunk origin:
x = 8000 m
y = 5500 m

GPU position:
x = 420.3
y = 110.8
```

This keeps render coordinates small without altering geographic identity.

---

## 12. Avoid unnecessary global floating origin

The original technical draft proposed a classic floating-origin approach.

For OpenGTA Web's new 2D-first architecture, a full scene-wide floating-origin implementation should **not** be assumed.

Instead, prefer:

```text
stable geographic identity
+
stable region-local world model
+
chunk-local/runtime-local placement
+
small renderer coordinates
```

This solves most precision problems without repeatedly mutating canonical world coordinates.

---

## 13. Runtime origin

The runtime may maintain a current origin near the player.

Conceptually:

```ts
interface RuntimeOrigin {
    regionPosition: Vec2;
}
```

Dynamic objects can be represented as:

```text
runtimePosition = regionPosition - runtimeOrigin
```

Static chunks can receive equivalent placement transforms.

When the player moves far enough, the runtime origin may shift.

The canonical world data does not change.

---

## 14. Rebase model

If long-distance continuous travel is eventually supported:

```text
player travels far from runtime origin
        ↓
threshold reached
        ↓
choose new runtime origin
        ↓
update runtime transforms
        ↓
canonical geographic/local data unchanged
```

This is preferable to mutating all authoritative coordinates.

Rebasing should be a runtime/render concern.

---

## 15. JavaScript numerical precision

JavaScript `number` uses double-precision floating point.

For CPU-side geographic and canonical local calculations, this provides substantially more precision than GPU float coordinates typically require.

Therefore:

- keep geographic and canonical calculations in ordinary double-precision numbers initially;
- avoid premature fixed-point representation;
- avoid premature coordinate compression;
- keep GPU-facing values local and small.

Typed/fixed representations may be introduced later if profiling or serialization requirements justify them.

---

## 16. GPU precision

GPU rendering often operates with 32-bit floating-point values.

Large absolute coordinates can therefore reduce visual precision.

Preferred solution:

```text
do not upload huge global coordinates
```

Instead:

```text
canonical region position
-
active render/chunk origin
=
small GPU coordinate
```

This is particularly suitable for the 2D top-down model.

---

## 17. Gameplay precision

Vehicle physics and collision should use local metric-like coordinates.

Example:

```text
car length = 4.3 m
road width = 7.0 m
speed = 15 m/s
```

This is much easier to reason about than arbitrary renderer units.

The renderer may later scale canonical meters to pixels through zoom/camera transforms.

---

## 18. Physics space

Physics coordinates should remain close to canonical runtime coordinates.

Preferred conceptual relation:

```text
1 physics unit ≈ 1 canonical meter
```

The physics adapter may use:

```text
runtimePosition
```

rather than geographic or huge region coordinates.

If a future physics library has its own numerical constraints, conversion should occur inside the physics adapter.

---

## 19. Render scale

Renderer scale is independent.

Example:

```text
1 canonical meter
    ↓ camera zoom
N screen pixels
```

Fake building height may be expressed as:

- source height metadata;
- normalized height class;
- derived pixel/render offset.

The coordinate model should not bake a permanent pixel-per-meter value into canonical world geometry.

---

## 20. Geographic bounds

Acquisition requests should use geographic bounds.

Conceptually:

```ts
interface GeoBounds {
    north: number;
    south: number;
    east: number;
    west: number;
}
```

After acquisition, those bounds can be projected into local planar bounds.

The engine should distinguish clearly:

```text
GeoBounds
```

from:

```text
Bounds2D
```

---

## 21. Antimeridian and polar edge cases

The final arbitrary-coordinate mode is global in intent.

Therefore, geographic utilities should not assume:

```text
west < east
```

in every possible case.

Crossing the antimeridian and extreme latitudes should be recognized as special cases.

However:

- they are not required in the first prototype;
- they should not complicate initial implementation;
- APIs should avoid assumptions that make future support impossible.

Global compatibility remains a target to validate, not an immediate guarantee.

---

## 22. Latitude limits

Some web-map projections become problematic near the poles.

Because the game is not required to use Web Mercator as canonical gameplay space, the engine should keep projection choice isolated.

If a chosen data source imposes latitude limits, those are source/provider constraints rather than world-model truths.

---

## 23. Roads across chunk boundaries

A road may cross multiple future chunks.

The canonical model should preserve the original semantic feature.

The compiler may:

- clip geometry per chunk;
- duplicate boundary references;
- create chunk-local segments;
- retain a common parent feature ID.

Example:

```text
Canonical RoadFeature R123
        ↓ compiler
Chunk A: segment R123:A
Chunk B: segment R123:B
Chunk C: segment R123:C
```

The exact segmentation scheme is deferred.

---

## 24. Buildings across chunk boundaries

A building footprint may cross a chunk boundary.

Avoid forcing canonical building geometry to split merely because of runtime chunking.

Possible compiler strategies:

- assign building to one owning chunk;
- duplicate render references;
- clip derived geometry;
- create shared/static feature ownership.

The first chunking ADR should benchmark alternatives.

---

## 25. Chunk grid should not define geographic truth

Do not derive world identity solely from a fixed 150 m grid or any other currently hypothesized chunk size.

Chunking is a runtime/packaging optimization.

Geographic feature identity must remain valid if chunk dimensions later change.

---

## 26. Potential stable spatial key

A future package/cache key may combine:

```text
provider
data revision
geographic tile/cell identifier
compiler version
schema version
```

The exact spatial indexing scheme is not defined.

Possible future choices include:

- slippy-map tile IDs;
- geohash;
- S2-like cells;
- H3-like cells;
- custom local grid.

No such scheme is accepted by this document.

---

## 27. Distance calculations

Gameplay distance should be calculated in local planar coordinates whenever features are within the same active local region.

For longer distances or region-to-region operations:

- use geographic calculations;
- or use an appropriate global/geodesic helper.

Do not use raw Euclidean distance between latitude/longitude degrees.

---

## 28. Orientation

Canonical orientation should use a single documented planar convention.

Recommended direction:

```text
0 radians = +X / east
positive rotation = counter-clockwise
```

or another consistent choice.

The exact convention should be fixed before vehicle implementation.

Renderer adapters must convert if their coordinate orientation differs.

---

## 29. North alignment

A geographic area should have a stable relation to north.

Preferred initial assumption:

```text
+Y = geographic north
+X = geographic east
```

This makes OSM-derived geometry intuitive.

A renderer with downward-positive screen Y must convert internally rather than changing world semantics.

---

## 30. Screen Y inversion

Many 2D renderers treat:

```text
+Y = downward
```

while canonical geographic space may prefer:

```text
+Y = north/up
```

The renderer adapter should handle this conversion explicitly.

Do not contaminate canonical geometry with screen-axis conventions.

---

## 31. Camera rotation

The initial camera should preferably keep geographic north stable.

If future gameplay allows camera rotation, rotation should be a view transform only.

World coordinates remain:

```text
+X east
+Y north
```

---

## 32. Preprocessed package coordinates

Preprocessed packages should not store only screen-space baked coordinates.

They should retain enough spatial metadata to:

- position interactive features correctly;
- support collisions;
- support zoom;
- support navigation/gameplay;
- support future package-version migration.

Visual baking may use raster tiles, but collision and semantic data should remain spatially grounded.

---

## 33. Runtime open-world coordinates

In Open World Runtime Mode:

```text
user selects lat/lon
        ↓
create/load working origin
        ↓
request nearby geographic data
        ↓
normalize to local coordinates
        ↓
compile
        ↓
runtime
```

As the player moves:

```text
approach active area boundary
        ↓
request neighbor geographic area
        ↓
project into compatible region/runtime space
        ↓
activate next chunk
```

The player should not experience a discontinuity when the underlying local representation changes.

---

## 34. Region size

The size of a coordinate region is not fixed yet.

A region may represent:

- a fixed-radius working area;
- a city sector;
- a group of chunks;
- an adaptive session window.

The optimal size should be chosen based on:

- projection accuracy;
- package size;
- memory;
- chunking;
- player speed;
- source request behavior.

Do not make region size identical to chunk size by assumption.

---

## 35. Projection error budget

Before accepting a projection, define measurable tolerances.

Potential later test questions:

- What is distance error at 1 km from origin?
- At 5 km?
- At 20 km?
- Does road width remain visually/physically correct?
- Does a 100 m measured route remain approximately 100 canonical units?
- Does error materially affect vehicle handling?

The first vertical slice can tolerate very small bounded projection error if documented.

---

## 36. Suggested first projection experiment

For the first fixed urban fixture, implement two interchangeable projector candidates:

```text
A. simple local equirectangular approximation
B. more rigorous local metric/tangent projection
```

Run fixture tests comparing:

- pairwise distances;
- bounding-box size;
- round-trip lat/lon error;
- computational cost.

If the simple version is sufficiently accurate over the intended prototype radius, it may be used temporarily.

The abstraction boundary must still allow replacement.

---

## 37. Round-trip capability

Where practical:

```text
GeoCoordinate
→ Local Vec2
→ GeoCoordinate
```

should produce a close approximation to the original coordinate.

This helps:

- debugging;
- map interaction;
- sharing player positions;
- source updates;
- multiplayer/world persistence.

Exact geodesic-perfect inversion is not required for the first prototype.

---

## 38. Coordinate metadata in CompiledChunk

A compiled chunk should eventually contain enough spatial information to reconstruct its placement.

Conceptually:

```ts
interface CompiledChunkSpatialInfo {
    schemaVersion: number;

    geoOrigin?: GeoOrigin;

    regionOrigin: Vec2;
    localBounds: Bounds2D;
}
```

The final schema may differ.

Avoid storing only arbitrary renderer-local coordinates without a stable spatial anchor.

---

## 39. Static and dynamic entity coordinates

Static geographic features:

```text
canonical region-local coordinates
```

Dynamic gameplay entities:

```text
runtime-local coordinates
+
optional stable geographic/world reference when persistence requires it
```

For a simple local session, player/vehicle geographic coordinates do not need to be recomputed every frame.

They can be reconstructed periodically or when required.

---

## 40. Multiplayer implications

Future multiplayer should not synchronize raw screen coordinates.

A likely architecture is:

```text
server/world authority
uses stable region/world coordinates

client
converts to local runtime/render coordinates
```

Exact multiplayer authority and precision are outside current scope.

The coordinate architecture must merely avoid making future synchronization impossible.

---

## 41. Persistence implications

If player/world state is saved, persistent positions should use a stable representation.

Candidate future form:

```text
region/world identifier
+
canonical local position
+
geographic anchor
```

or direct geographic position where appropriate.

Do not persist transient GPU coordinates.

---

## 42. Cache implications

Cached chunks should include or reference the coordinate-system/projection version used to compile them.

Potential metadata:

```text
projectionStrategy
projectionVersion
geoOrigin
compilerVersion
schemaVersion
```

If projection behavior changes incompatibly, cached data can be invalidated or migrated.

---

## 43. Versioning

Coordinate/projection logic should be versionable.

Example conceptual version domain:

```text
COORDINATE MODEL VERSION
```

This should remain distinct from:

- source-data revision;
- compiler version;
- compiled chunk schema version.

A change to coordinate semantics may require cache invalidation even if the rest of the schema remains structurally compatible.

---

## 44. Test fixtures

Coordinate tests should use known geographic points.

Test categories:

### Same-point test

```text
origin → (0, 0)
```

within numerical tolerance.

### Cardinal direction tests

Points slightly:

- north;
- south;
- east;
- west.

Verify expected signs.

### Distance test

Known close points should produce approximately expected metric distance.

### Round-trip test

```text
geo → local → geo
```

### Region-boundary test

Neighboring features should preserve relative position.

### Chunk-offset test

Chunk-local conversion should reconstruct region-local position.

---

## 45. Precision stress tests

Later tests should cover:

- dense historic centers;
- large city extents;
- long straight roads;
- high latitudes;
- very small building footprints;
- many chunk transitions.

These do not all belong to the first implementation task.

---

## 46. Debug tools

A coordinate debug mode should eventually display:

```text
player lat/lon
region origin
region-local position
runtime origin
runtime-local position
active chunk ID
chunk-local position
distance from runtime origin
```

This will make precision/rebasing bugs much easier to diagnose.

---

## 47. Failure rules

Coordinate conversion must reject or report:

- NaN;
- infinite values;
- latitude outside valid geographic range;
- invalid longitude normalization;
- invalid empty origin;
- impossible geometry after conversion.

Avoid silently converting malformed data into world coordinates.

---

## 48. Performance

Coordinate projection is likely cheap relative to geometry generation and rendering, but this must still be measured for runtime world loading.

Possible optimizations later:

- vectorized conversion;
- typed arrays;
- worker-side projection;
- precomputed scale factors;
- batch conversion.

Do not complicate the first implementation before profiling.

---

## 49. Worker boundary

Coordinate conversion is a good candidate for the normalization/geometry worker.

Conceptually:

```text
Raw geographic data
        ↓ worker
projection
normalization
geometry cleanup
        ↓
Canonical World Model
```

The main thread should not need to convert thousands of OSM points synchronously if this causes visible stalls.

Worker topology itself remains a later decision.

---

## 50. Recommended module boundary

Possible direction:

```text
src/
└── geo/
    └── coordinates/
        ├── types.ts
        ├── projector.ts
        ├── local-projector.ts
        ├── bounds.ts
        └── tests/
```

Do not create this structure blindly if the existing repository already has an established organization.

Codex must inspect before modifying.

---

## 51. First implementation contract

For the first vertical slice, Codex should be able to implement:

```text
GeoCoordinate
GeoOrigin
Vec2
GeoBounds
Bounds2D

GeoProjector
    toLocal()
    toGeo()
```

and verify:

```text
fixed fixture
→ local metric-like coordinates
→ stable building/road geometry
```

No chunk rebasing is needed yet.

---

## 52. Codex rules

When Codex implements coordinate work:

1. Do not use latitude/longitude directly as gameplay XY.
2. Keep projection logic isolated.
3. Prefer local metric-like world coordinates.
4. Keep canonical coordinates independent from renderer axis conventions.
5. Do not introduce chunk size assumptions into projection code.
6. Do not mutate canonical coordinates when runtime origin changes.
7. Keep GPU coordinates small through local transforms rather than giant world coordinates.
8. Add round-trip and distance tests.
9. Document tolerances.
10. Do not over-engineer global rebasing in the first vertical slice.
11. Preserve a path toward arbitrary-coordinate open-world use.
12. Report if a chosen projection introduces material distance distortion.

---

## 53. Decision summary

Accepted by this document:

- WGS84 lat/lon is the persistent geographic reference.
- Gameplay does not operate directly on degrees.
- Canonical gameplay/world geometry is planar and local.
- Local units should be meter-like.
- Geographic projection is isolated behind a dedicated abstraction.
- Region-local coordinates are preferred over global giant projected values.
- Renderer/GPU coordinates should remain close to a local origin.
- Full 3D floating-origin architecture is not assumed.
- Runtime rebasing, if needed, must not mutate canonical geographic truth.
- Chunking does not define feature identity.
- The first vertical slice needs only a bounded local projection.
- Precision must be tested quantitatively.

Not accepted by this document:

- final projection formula;
- final region size;
- final chunk size;
- final spatial-key system;
- rebasing threshold;
- final coordinate serialization;
- final multiplayer position format;
- final cache key scheme.

---

## 54. Recommended next decision

The next focused architecture step should define:

```text
WORLD COMPILER CONTRACT
```

including:

- inputs;
- outputs;
- derived geometry responsibilities;
- chunk partition boundary;
- deterministic compilation;
- renderer/physics adapters;
- what is compiled offline versus runtime;
- what remains optional visual enrichment.

After that, renderer and physics technologies can be evaluated against concrete data contracts instead of abstract requirements.
