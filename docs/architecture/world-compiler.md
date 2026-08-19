# OpenGTA Web — World Compiler Contract

**Status:** Architecture design baseline  
**Date:** 2026-08-19

## 1. Purpose

The World Compiler is the explicit boundary between semantic geographic truth
and runtime-optimized data.

```text
Canonical World Model
        ↓
World Compiler
        ↓
CompiledChunk[]
```

It must support both offline execution and browser execution.

## 2. Compiler responsibilities

The compiler may:

- partition a region into runtime units;
- derive road-surface polygons from centerlines;
- prepare building roof/facade visual data;
- derive simple 2D collision geometry;
- simplify polygons by quality level;
- create render batches or batch descriptors;
- assign deterministic visual style categories;
- create static sprite placements;
- generate lookup/spatial indexes;
- emit optional LOD variants;
- emit serialization-ready data.

The compiler must not redefine geographic truth.

## 3. Inputs

Conceptually:

```ts
interface CompileRequest {
    region: WorldRegion;
    profile: CompileProfile;
}
```

A `CompileProfile` may express:

- target quality tier;
- runtime vs offline budget;
- optional simplification;
- optional static baking;
- optional visual enrichment availability.

## 4. Outputs

Conceptually:

```ts
interface CompileResult {
    chunks: CompiledChunk[];
    diagnostics: CompileDiagnostics;
}
```

A `CompiledChunk` should contain only data required to activate a local piece
of the world efficiently.

Candidate logical content:

```text
CompiledChunk
├── identity/version
├── spatial reference
├── ground/road render data
├── building render data
├── collision data
├── sprite instances
├── feature lookup metadata
├── optional LOD
└── optional visual enrichment references
```

The exact binary schema is deferred.

## 5. Determinism

Structural compilation should be deterministic where practical.

Same:

- canonical input;
- compiler version;
- compile profile;

should produce equivalent structural output.

AI-produced visuals are optional attachments and must not break structural
determinism.

## 6. Offline and runtime parity

The browser compiler and offline compiler must share the same semantic stages.

Preferred implementation:

```text
shared TypeScript/core logic
       │
       ├── offline Node/build entry point
       └── browser worker entry point
```

If an expensive offline-only optimization exists, it must attach to the shared
output contract rather than creating a separate world representation.

## 7. Road compilation

Input:

```text
RoadFeature.centerline
+ normalized metadata
```

Derived output may include:

- road polygon;
- edge geometry;
- marking descriptors;
- navigation hints;
- style class.

Road width fallback belongs to compile/style policy, not source truth.

## 8. Building compilation

Input:

```text
BuildingFeature.footprint
+ height/level metadata
+ semantic hints
```

Derived output may include:

- roof polygon;
- projected fake facade;
- shadow polygon;
- simplified collision polygon;
- visual height class;
- batch/style key.

No true 3D building mesh is required for the baseline.

## 9. Collision compilation

Collision output should remain planar.

Preferred data:

```text
polygons
segments
circles/point obstacles where useful
```

Visual fake height must not enlarge collision into 3D.

## 10. Static batching

The compiler should aim to minimize the number of runtime objects.

Possible output strategy:

```text
many source features
    ↓
few batch descriptors / packed buffers
```

Static world data should not require one heavyweight scene object per OSM
feature.

## 11. Quality profiles

Conceptual profiles:

```text
LIGHTWEIGHT
STANDARD
ENHANCED
```

Differences may include:

- polygon simplification;
- facade detail;
- static baking;
- texture resolution;
- decorative object count;
- LOD count.

The canonical model remains unchanged.

## 12. Runtime compiler constraints

Browser compilation must:

- be cancellable by chunk/request;
- avoid long main-thread stalls;
- expose progress/diagnostics;
- support fallback when optional enrichment fails;
- avoid requiring the whole requested city before first play.

## 13. Offline compiler advantages

Offline compilation may additionally:

- run expensive geometry repair;
- create optimized atlases;
- bake static backgrounds;
- perform AI visual generation;
- validate package integrity;
- generate multiple quality tiers;
- compress/package output.

## 14. Diagnostics

Compiler diagnostics should expose at least:

```text
input feature count
output feature/batch count
skipped feature count
warning count
compile time by stage
estimated serialized size
```

Later add memory and geometry statistics.

## 15. Compilation stages

Recommended explicit stages:

```text
1. validate canonical input
2. derive spatial partition
3. compile ground/land
4. compile roads
5. compile buildings
6. compile barriers/objects
7. compile collisions
8. compile styles
9. build indexes
10. optional simplify/LOD
11. emit diagnostics
```

These stages may be internally fused later for performance.

## 16. Cancellation

Open-world compilation must support cancellation.

Example:

```text
player moves away
→ requested chunk no longer useful
→ abort acquisition/compile/enrichment
```

Do not waste CPU/GPU/AI work on abandoned areas.

## 17. Version domains

Compiler output must eventually record:

- compiler version;
- compiled schema version;
- coordinate-model version;
- style profile version;
- optional visual-asset version.

## 18. Testing

Required test types:

- deterministic fixture tests;
- geometry invariant tests;
- road-width fallback tests;
- building-hole preservation tests;
- chunk boundary tests;
- compile cancellation tests;
- golden diagnostics for representative fixtures.

## 19. First implementation subset

V0 compiler should only support:

```text
BuildingFeature
RoadFeature
LandAreaFeature
WaterFeature
```

and emit:

```text
road polygons
building roof polygons
one fake facade representation
simple 2D collisions
minimal style keys
```

No AI, LOD, package compression or live streaming is required.

## 20. Codex constraints

Codex must not:

- bypass the compiler with renderer-specific OSM parsing;
- place renderer objects in compiler output;
- place physics-engine handles in compiler output;
- require AI;
- hard-code a final chunk size;
- silently drop unsupported geometry without diagnostics.

## 21. Open decisions

- exact `CompiledChunk` schema;
- chunk partition algorithm;
- polygon clipping library;
- triangulation strategy;
- buffer layout;
- serialization format;
- compression;
- LOD thresholds;
- static baking strategy.

These must be addressed incrementally.
