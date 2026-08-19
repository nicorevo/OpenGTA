# OpenGTA Web — Dual World Pipeline

**Status:** Architecture design baseline  
**Date:** 2026-08-19  
**Depends on:** `product-architecture-principles.md`  
**Purpose:** Define how Preprocessed World Mode and Open World Runtime Mode produce the same canonical world representation and are consumed by the same runtime.

---

## 1. Scope

OpenGTA Web supports two final world-loading modes:

1. **Preprocessed World Mode**
   - the world is compiled before distribution;
   - expensive work can be performed offline;
   - the client downloads prepared world packages;
   - intended to support slower browsers and lower-capability devices.

2. **Open World Runtime Mode**
   - the user may select arbitrary geographic coordinates;
   - geographic data is acquired and compiled at runtime;
   - visual enrichment may be generated locally in the browser;
   - server compute should be minimized where practical.

This document defines the architecture shared by both modes.

It does **not** select a final renderer, physics engine, map provider, cache format, serialization format or chunk size.

---

## 2. Architectural invariant

The two modes must not evolve into two different engines.

The primary invariant is:

```text
Different acquisition/compilation path
              ↓
Same canonical compiled world
              ↓
Same runtime
```

The runtime should not care whether a chunk was:

- produced days earlier by an offline pipeline;
- generated seconds earlier in a Web Worker;
- restored from local persistent cache;
- downloaded from an official static package.

---

## 3. High-level pipeline

```text
                             ┌──────────────────────┐
                             │ Geographic data     │
                             │ OSM / future sources│
                             └──────────┬───────────┘
                                        │
                              ┌─────────▼─────────┐
                              │ GeoDataSource     │
                              └─────────┬─────────┘
                                        │
                              ┌─────────▼─────────┐
                              │ Normalization     │
                              │ + validation      │
                              └─────────┬─────────┘
                                        │
                              ┌─────────▼─────────┐
                              │ Canonical         │
                              │ World Model       │
                              └─────────┬─────────┘
                                        │
                              ┌─────────▼─────────┐
                              │ World Compiler    │
                              └─────────┬─────────┘
                                        │
                              ┌─────────▼─────────┐
                              │ CompiledChunk     │
                              └─────────┬─────────┘
                                        │
                   ┌────────────────────┴────────────────────┐
                   │                                         │
          Preprocessed package                      Runtime/local cache
                   │                                         │
                   └────────────────────┬────────────────────┘
                                        │
                              ┌─────────▼─────────┐
                              │ Shared Runtime    │
                              ├───────────────────┤
                              │ Renderer adapter  │
                              │ Physics adapter   │
                              │ Gameplay systems  │
                              └───────────────────┘
```

---

## 4. Layer responsibilities

### 4.1 GeoDataSource

Responsible only for acquiring raw geographic information.

Possible implementations may include:

```text
LocalFixtureSource
OfficialPackageSource
OpenStreetMapSource
OverpassSource
CachedSource
FutureProviderSource
```

The interface must hide provider-specific details from the rest of the engine.

Conceptual contract:

```ts
interface GeoDataSource {
    load(request: GeoRequest): Promise<RawGeoData>;
}
```

This is not a final TypeScript API. It expresses the required separation.

The rest of the pipeline must not assume that raw data always comes directly from Overpass.

---

### 4.2 Geo normalization

Responsible for converting source-specific data into a stable internal geographic representation.

Typical responsibilities:

- source-ID normalization;
- coordinate conversion inputs;
- geometry cleanup;
- closed polygon validation;
- relation/multipolygon interpretation;
- tag normalization;
- feature classification;
- missing-data fallback metadata;
- source provenance.

Output:

```text
NormalizedGeoData
```

This layer should still preserve enough source metadata for debugging and future visual rules.

---

### 4.3 Canonical World Model

This is the authoritative logical representation of the local world before rendering-specific compilation.

It should contain concepts such as:

```text
World
├── Buildings
├── Roads
├── Water
├── Land areas
├── barriers
├── static objects
└── metadata
```

The model is **2D-first**.

Examples:

```ts
interface BuildingFeature {
    id: string;
    footprint: Polygon2D;
    visualHeight?: number;
    tags: Record<string, string>;
}

interface RoadFeature {
    id: string;
    centerline: Polyline2D;
    width?: number;
    class?: string;
    tags: Record<string, string>;
}
```

Exact field definitions belong to a later `world-model.md` document.

The canonical model must not contain Three.js objects, physics-engine bodies or renderer-native textures.

---

### 4.4 World Compiler

Responsible for converting the canonical world model into data optimized for runtime consumption.

Conceptually:

```text
Canonical World Model
        ↓
World Compiler
        ↓
CompiledChunk
```

Possible compiler work:

- spatial partitioning;
- road polygon generation;
- building render representation;
- static batching metadata;
- collision polygon preparation;
- sprite placement;
- visual-style assignment;
- optional fake-2.5D metadata;
- optional LOD generation;
- runtime lookup indexes;
- serialization-ready data preparation.

The compiler must remain usable in both:

- an offline build environment;
- the browser runtime.

Where a step cannot realistically be shared, the difference must occur behind a compatible stage/interface rather than creating a second world model.

---

## 5. Preprocessed World Mode pipeline

The offline path is:

```text
Raw geographic source
    ↓
GeoDataSource
    ↓
Normalization
    ↓
Canonical World Model
    ↓
World Compiler
    ↓
Optional expensive preprocessing
    ↓
World Package Builder
    ↓
Static distributable assets
```

The generated package may eventually contain:

```text
world/
├── manifest
├── chunks
├── textures
├── atlases
├── optional style assets
└── optional metadata/indexes
```

The precise on-disk format is not decided yet.

### 5.1 Work suitable for offline preprocessing

Candidate operations include:

- geometry simplification;
- polygon cleanup;
- collision preparation;
- batching;
- spatial indexing;
- texture atlas generation;
- image compression;
- AI-assisted texture creation;
- region-specific style preparation;
- LOD generation;
- world consistency checks;
- package integrity checks.

Offline preprocessing is allowed to be substantially more expensive than runtime compilation.

---

## 6. Open World Runtime Mode pipeline

The runtime path is:

```text
User-selected coordinates
    ↓
Area request
    ↓
GeoDataSource
    ↓
Normalization
    ↓
Canonical World Model
    ↓
Browser World Compiler
    ↓
CompiledChunk
    ↓
Optional visual enrichment
    ↓
Shared Runtime
```

Compilation should preferentially happen outside the main rendering thread when browser technology allows it.

Conceptually:

```text
MAIN THREAD
- input
- runtime coordination
- rendering submission

WORKER(S)
- data parsing
- normalization
- geometry preparation
- chunk compilation
- optional background enrichment
```

This worker split is a target architecture, not yet a final worker count or implementation.

---

## 7. Shared compiled representation

Both pipelines converge on a canonical compiled unit.

Conceptually:

```ts
interface CompiledChunk {
    schemaVersion: number;
    id: string;

    origin: GeoOrigin;
    bounds: Bounds2D;

    staticVisuals: StaticVisualData;
    roads: CompiledRoadData;
    buildings: CompiledBuildingData;

    collisions: Collision2DData;
    sprites: SpriteInstanceData[];

    featureIndex: FeatureIndexData;

    optional?: {
        lod?: LodData;
        visualEnrichment?: VisualEnrichmentData;
    };
}
```

The exact schema is intentionally deferred.

The critical requirement is that the runtime sees the **same logical contract** in both modes.

---

## 8. Chunk lifecycle

A chunk should support the following lifecycle:

```text
UNKNOWN
  ↓
REQUESTED
  ↓
ACQUIRING
  ↓
NORMALIZING
  ↓
COMPILING
  ↓
READY
  ↓
ACTIVE
  ↓
INACTIVE
  ↓
CACHED / DISCARDED
```

For preprocessed content, some stages are skipped at runtime:

```text
REQUESTED
  ↓
DOWNLOADING
  ↓
DECODING
  ↓
READY
```

The runtime should still receive the same `READY` representation.

---

## 9. Package/cache equivalence

The architecture should make official packages and local runtime cache conceptually similar.

Example:

```text
Official preprocessed chunk
        ↓
decode
        ↓
CompiledChunk
```

and:

```text
Runtime-generated chunk
        ↓
serialize/cache
        ↓
later decode
        ↓
CompiledChunk
```

This allows the browser to avoid recompiling unchanged areas repeatedly.

The serialization format must therefore eventually support:

- schema versioning;
- cache invalidation;
- source-data version/provenance;
- optional compression;
- backwards-compatibility strategy or explicit migration/discard rules.

---

## 10. Visual enrichment pipeline

Visual enrichment is downstream from geographic truth.

```text
Canonical/Compiled world truth
              ↓
       Visual Style Resolver
              ↓
 ┌────────────┴────────────┐
 │                         │
Deterministic         Optional AI
rules                 enrichment
 │                         │
 └────────────┬────────────┘
              ↓
      Visual presentation
```

### 10.1 Deterministic path

Must always exist.

Possible inputs:

- OSM tags;
- road class;
- building type;
- land use;
- geographic region;
- locally available asset library.

Possible output:

- predefined textures;
- palette;
- sprite choice;
- facade style category;
- roof style category.

### 10.2 AI-enhanced path

Optional.

Possible output:

- generated texture variation;
- style descriptor;
- facade texture;
- roof texture;
- decorative assets.

The AI output must not redefine:

- road existence;
- road topology;
- building footprint;
- collision boundaries;
- geographic coordinates.

---

## 11. Client capability adaptation

The runtime should be able to choose an execution path based on device capability.

Conceptual capability profile:

```ts
interface ClientCapabilities {
    runtimeCompilation: boolean;
    workerConcurrency: number;
    advancedVisuals: boolean;
    localAI: boolean;
    persistentCache: boolean;
}
```

This is illustrative only.

A possible decision flow:

```text
Can load official preprocessed package?
        │
        ├── yes → preferred on weak devices
        │
        └── no / user selected arbitrary coordinates
                    ↓
            Can compile runtime world?
                    │
              ┌─────┴─────┐
              │           │
             yes          no
              │           │
       compile locally   unsupported path /
              │          fallback messaging
              ↓
       deterministic visuals
              ↓
       local AI available?
              │
        ┌─────┴─────┐
        │           │
       yes          no
        │           │
   enrich visuals   render basic world
```

The exact capability-detection policy will require benchmark data.

---

## 12. Server responsibilities

The architecture should avoid assuming that the application server is responsible for generating worlds.

Potential server/CDN responsibilities:

- serving the application;
- serving preprocessed world packages;
- serving static visual assets;
- authentication;
- future multiplayer authority;
- package/version manifests;
- optional proxying or rate-control where required.

Potentially avoidable server responsibilities:

- generating every user's textures;
- compiling every arbitrary coordinate request;
- rendering world geometry;
- performing continuous AI inference for routine world presentation.

A server-side fallback may still be introduced later if product requirements justify its cost.

---

## 13. Failure handling

Open World Runtime Mode must expect partial or imperfect source data.

Failures should be isolated by stage.

Examples:

```text
Acquisition failure
→ retry / alternate source / user feedback

Invalid geometry
→ skip or repair individual feature where possible

Visual enrichment failure
→ deterministic fallback

AI unavailable
→ deterministic fallback

Persistent cache unavailable
→ continue without persistent cache

Single chunk compilation failure
→ isolate the chunk; do not corrupt global runtime
```

The core game should not fail merely because optional enrichment failed.

---

## 14. Determinism and reproducibility

The non-AI compilation path should be reproducible where practical.

Given:

- the same source data;
- the same compiler version;
- the same configuration;

the resulting structural world data should be equivalent.

This is important for:

- debugging;
- tests;
- cache validity;
- offline/runtime comparison;
- future multiplayer consistency;
- package generation.

Optional generated visual assets may have different reproducibility requirements, but they must remain detachable from world truth.

---

## 15. Versioning

At least three version domains should eventually be considered separately:

```text
SOURCE DATA VERSION
COMPILER VERSION
COMPILED WORLD SCHEMA VERSION
```

Potential future visual asset/version domains may also exist.

Example conceptual manifest:

```json
{
  "worldId": "example",
  "sourceRevision": "...",
  "compilerVersion": "...",
  "schemaVersion": 1
}
```

No final manifest schema is selected by this document.

---

## 16. Performance philosophy

The Open World Runtime pipeline should be designed around progressive readiness.

Avoid requiring:

```text
download whole area
→ compile whole area
→ enrich whole area
→ finally start game
```

Prefer:

```text
request nearby area
→ compile minimum playable area
→ start
→ progressively prepare neighbors
```

The exact preload radius, chunk dimensions and concurrency must be benchmarked later.

Preprocessed World Mode may exploit much more aggressive ahead-of-time optimization.

---

## 17. Technology boundaries

No stage in this pipeline currently requires a particular technology.

Examples of implementation decisions that remain open:

```text
Renderer
Physics
Source API
Binary serialization
Compression
Worker orchestration
Persistent cache
AI runtime
Texture format
Spatial index
```

Each major selection should be documented through an ADR when the choice becomes actionable.

---

## 18. First implementation strategy

The first vertical slice should exercise the shared pipeline without implementing both final acquisition modes.

Recommended first path:

```text
LocalFixtureSource
      ↓
Normalization
      ↓
Canonical World Model
      ↓
World Compiler
      ↓
CompiledChunk
      ↓
Renderer + 2D collision
```

Why:

- deterministic input;
- no rate-limit noise;
- reproducible tests;
- easier debugging;
- exercises the architecture shared by both final modes.

Only after the shared path works should a live runtime geographic source be introduced.

The preprocessed packager can also be introduced later using the same compiler.

---

## 19. Codex implementation rules

When Codex works on this pipeline:

1. Do not bypass the canonical world model by sending raw OSM data directly into the renderer.
2. Do not create a separate runtime representation for preprocessed worlds unless a measured need requires it.
3. Do not make optional AI a required dependency.
4. Do not introduce server-side world generation merely because it is easier to prototype.
5. Do not assume chunk dimensions before benchmarking.
6. Keep source adapters replaceable.
7. Keep renderer-specific and physics-specific objects outside the canonical world model.
8. Prefer deterministic fixtures in early tests.
9. Make serialization/version boundaries explicit when persistence is introduced.
10. Report any architectural conflict before solving it with an irreversible shortcut.

---

## 20. Validation criteria for this architecture

The architecture should be considered validated only when a later prototype demonstrates that:

1. the same canonical world model can feed both offline and runtime compilation;
2. a locally compiled chunk and a packaged chunk can be consumed by the same runtime;
3. deterministic rendering works without AI;
4. optional enrichment can be added or removed without changing collision/world truth;
5. chunk lifecycle can load/unload areas without leaking renderer/physics implementation into the world model;
6. browser compilation does not block interaction beyond accepted limits;
7. weaker devices can use a lower-cost path.

Exact quantitative thresholds belong to later benchmark documents.

---

## 21. Open questions

The following questions are intentionally unresolved:

- What is the final geographic projection/local coordinate strategy?
- What is the optimal chunk size?
- Should chunks be square, hierarchical tiles, or another partition?
- Which source strategy should be used for arbitrary-coordinate runtime loading?
- What binary/serialized format should `CompiledChunk` use?
- How should compiler output be compressed?
- Which renderer best matches 2D-first/fake-2.5D requirements?
- Is a dedicated 2D physics engine necessary?
- What visual work should be deterministic versus AI-generated?
- Which client AI technology is realistic on target hardware?
- How large may the persistent cache become?
- How should source data updates invalidate cached/generated worlds?
- What operations should run in one worker versus multiple workers?

Each question should be resolved through a focused design/ADR step rather than incidental implementation.

---

## 22. Decision summary

Accepted by this document:

- two world modes exist;
- both modes share one canonical architecture;
- both converge to the same compiled world representation;
- the canonical model is renderer/physics independent;
- offline preprocessing may be expensive;
- runtime compilation should preferentially happen client-side/background where practical;
- AI is optional visual enrichment;
- local runtime output should be cacheable;
- the first prototype should use deterministic local fixture data.

Not accepted by this document:

- renderer;
- physics engine;
- chunk dimensions;
- storage technology;
- serialization format;
- geographic provider;
- worker count;
- AI model/runtime;
- server topology.
