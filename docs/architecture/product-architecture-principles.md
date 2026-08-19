# OpenGTA Web — Product & Architecture Principles

**Status:** Product/architecture baseline extension  
**Date:** 2026-08-19  
**Purpose:** Define the non-negotiable product and architectural principles that future technical decisions and Codex implementation work must respect.

---

## 1. Product identity

OpenGTA Web is a **browser-first geospatial sandbox/game engine** that transforms real urban areas described primarily by OpenStreetMap data into a recognizable, explorable and drivable world.

The product is inspired by the readability and interaction model of the first top-down Grand Theft Auto games, but it is not intended to reproduce their assets or implementation.

The initial technical objective is not to build a complete GTA-like game. Missions, combat, progression, economy and other advanced gameplay systems remain outside the first validation unless introduced by a later product decision.

---

## 2. Two final world modes

The final product must support two different ways to obtain the game world.

### 2.1 Preprocessed World Mode

The user selects an area that has already been prepared before runtime.

Expensive work may be performed offline, including where useful:

- geographic data normalization;
- geometry preparation;
- collision preparation;
- spatial indexing;
- visual asset generation;
- texture generation and packing;
- level-of-detail preparation;
- static batching;
- metadata generation;
- optional AI-assisted visual preprocessing.

The browser should mainly:

1. download the prepared package;
2. decode/load the required local area;
3. render and simulate it.

This mode exists specifically to make OpenGTA Web usable on slower browsers and less capable devices.

Preprocessed areas may later become curated or officially distributed cities/regions.

### 2.2 Open World Runtime Mode

The user may choose arbitrary geographic coordinates.

The browser must be capable of:

1. acquiring the required geographic source data;
2. normalizing it;
3. compiling it into the internal world representation;
4. creating the visual representation;
5. preparing collisions and runtime metadata;
6. progressively loading the surrounding area.

Where computationally reasonable, expensive visual enrichment — including future AI-based processing — should preferentially happen **client-side**, in order to avoid high recurring server-compute costs.

Open World Runtime must still function without AI enhancement.

---

## 3. One engine, not two

Preprocessed World Mode and Open World Runtime Mode must **not** become two independent engines.

Both modes must converge on the same canonical runtime representation.

Conceptually:

```text
                         ┌──────────────────────────────┐
Raw geographic data ───►│ Shared normalization/compiler│
                         └──────────────┬───────────────┘
                                        │
                     ┌──────────────────┴──────────────────┐
                     │                                     │
              Offline execution                      Browser execution
                     │                                     │
              World Package                         Compiled Chunk
                     │                                     │
                     └──────────────────┬──────────────────┘
                                        │
                                  Shared Runtime
```

The runtime should consume the same type of world data regardless of whether it was:

- compiled before distribution;
- compiled locally in the user's browser;
- restored from local cache.

---

## 4. 2D-first world

OpenGTA Web is **not a full 3D world simulation**.

The canonical world model, gameplay model and collision model must be designed as **2D-first**.

The intended visual presentation is:

- top-down;
- immediately readable;
- visually similar in spatial logic to early top-down GTA;
- enhanced with only inexpensive artificial depth when useful.

The engine must not require a perspective 3D world merely to make buildings appear tall.

### 4.1 Canonical rule

```text
WORLD MODEL  = 2D-first
GAMEPLAY     = 2D-first
PHYSICS      = predominantly 2D
COLLISIONS   = predominantly planar
RENDERING    = 2D + optional fake 2.5D
HEIGHT / Z   = mainly visual metadata
```

---

## 5. Fake 2.5D, not mandatory 3D geometry

Depth should preferably be suggested rather than physically modeled.

Acceptable low-cost techniques include:

- projected facade strips;
- roof offsets;
- baked or simple shadows;
- layered sprites;
- texture-based depth cues;
- small parallax effects;
- screen-space offsets;
- limited visual extrusion only where profiling proves it worthwhile.

A building should primarily exist as a **2D footprint**.

Conceptually:

```text
Building
├── footprint            authoritative geographic shape
├── collision footprint  gameplay/physics shape
├── roof visual
├── visual height        optional rendering metadata
├── facade/style data    optional rendering metadata
└── source metadata
```

A visual height must not automatically imply a true 3D physics volume.

---

## 6. Camera principle

The camera should remain fundamentally top-down.

The appearance of building facades or height should preferably come from the rendering technique, not from requiring a strongly inclined perspective camera.

The renderer may use a limited technical 3D coordinate system internally if useful, but that must remain an implementation detail rather than changing the 2D-first world model.

---

## 7. Deterministic world truth vs visual enrichment

The authoritative structure of the world must not depend on generative AI.

The following should be deterministic whenever source data permits:

- geographic coordinates;
- road topology;
- building footprints;
- water areas;
- land-use areas;
- collision boundaries;
- navigation-relevant structure;
- world identifiers and chunk boundaries.

AI may be used as an optional **visual enrichment layer**, for example to help determine or generate:

- texture variations;
- facade appearance;
- regional palettes;
- roof styles;
- surface details;
- decorative visual assets.

AI must not be required to determine whether a road or building physically exists.

---

## 8. Graceful degradation

The product must be capable of adapting to different client capabilities.

A lower-performance device should receive a simpler representation rather than being excluded whenever possible.

The architecture should make room for capability tiers such as:

```text
Tier 0 — preprocessed world, lightweight rendering
Tier 1 — runtime world generation, deterministic visuals
Tier 2 — richer procedural visuals
Tier 3 — optional client-side AI visual enrichment
```

These are architectural categories, not final user-facing names or final performance thresholds.

No capability tier is considered validated until measured.

---

## 9. Local reuse and caching

Runtime-generated world data should be reusable where practical.

A useful target behavior is:

```text
First visit
geographic data
    → compile
    → optional visual enrichment
    → runtime world
    → local cache

Later visit
local cache
    → runtime world
```

An Open World area already processed by a client should therefore be able to behave similarly to a locally preprocessed area on subsequent visits.

The exact cache technology, format, limits and invalidation rules remain technical decisions to validate.

---

## 10. Canonical world representation

The architecture must introduce a renderer-independent and physics-engine-independent world representation.

The intended direction is:

```text
GeoDataSource
    ↓
Geo normalization
    ↓
Canonical World Model
    ↓
World Compiler
    ↓
Compiled World / Compiled Chunk
    ↓
Runtime adapters
    ├── Renderer
    ├── Physics
    └── Gameplay
```

The OpenStreetMap parser must not directly create renderer-specific objects.

The canonical model must not depend on a specific graphics library, physics engine, network library or data-acquisition service.

---

## 11. World packages and runtime chunks

The system should make it possible for preprocessed and runtime-generated areas to share the same logical chunk/package format.

A future compiled unit may contain concepts such as:

```text
CompiledChunk
├── geographic origin
├── 2D bounds
├── static visual geometry
├── road geometry
├── building footprints
├── collision polygons
├── sprite instances
├── visual metadata
├── source-feature metadata
└── optional LOD/cache information
```

This is a conceptual contract only. Field layout, serialization format and chunk dimensions are not yet accepted technical decisions.

A chunk is defined conceptually as a unit that can be independently:

- generated;
- loaded;
- unloaded;
- cached;
- rendered;
- distributed.

Its physical dimensions must be determined by measurement, not assumed from the original draft.

---

## 12. Client-side computation preference

For Open World Runtime Mode, client-side computation is preferred when it:

- avoids recurring server-compute costs;
- remains compatible with acceptable responsiveness;
- can be isolated in workers or equivalent background execution;
- can degrade gracefully on weaker hardware.

This is not a rule that all computation must happen client-side.

Server-side computation remains valid when security, data distribution, latency, consistency or hardware requirements make it the better architectural choice.

The objective is to avoid unnecessary permanent infrastructure cost, not to prohibit servers.

---

## 13. Technology neutrality at this stage

The following are **not yet architectural truths** merely because they appeared in the original technical draft:

- Three.js;
- Rapier;
- Earcut;
- Nominatim;
- Overpass as the only acquisition strategy;
- IndexedDB as the final cache design;
- Geckos.io;
- Socket.io;
- 150 m × 150 m chunks;
- 3×3 loaded chunk windows;
- 30 Hz multiplayer synchronization;
- a full WebGL/WebGPU 3D scene graph.

They may prove appropriate, but each important choice must be validated separately.

In particular, because the final presentation is 2D-first, the renderer must be evaluated against technologies optimized for:

- sprites;
- polygon batching;
- texture atlases;
- large numbers of static objects;
- low draw-call counts;
- browser portability;
- efficient top-down rendering.

Three.js must not be selected merely because it was present in the first draft.

---

## 14. Measurement before optimization commitments

Terms such as:

- fast;
- fluid;
- lightweight;
- scalable;
- mobile-friendly;

are not sufficient technical requirements.

Performance decisions must eventually be tied to:

- reference hardware;
- resolution;
- target frame rate;
- frame-time distribution;
- memory usage;
- world density;
- number of visible entities;
- loading latency;
- compilation latency.

Chunk dimensions, batching strategy, worker boundaries and visual complexity must be driven by measurements.

---

## 15. Incremental implementation

Development must proceed through small, verifiable vertical increments.

Codex should not be asked to implement broad roadmap phases when a smaller independently testable step is possible.

A preferred sequence is:

```text
product constraints
    ↓
architecture contracts
    ↓
technology evaluation / ADR
    ↓
small implementation task
    ↓
measurement / test
    ↓
decision confirmation or revision
```

Documentation must distinguish clearly between:

- product requirement;
- accepted architecture decision;
- hypothesis;
- experiment;
- implementation detail.

---

## 16. Initial validation scope

The first technical validation should remain intentionally small.

It should prove that the architecture can eventually support the final product without trying to implement the complete product immediately.

A first vertical slice may therefore use:

- one fixed geographic area;
- local fixture data instead of live world acquisition;
- deterministic simple visuals;
- one vehicle;
- planar collision;
- no multiplayer;
- no pedestrians;
- no traffic simulation;
- no AI requirement;
- no city-scale streaming.

The purpose is to validate the pipeline, not to demonstrate all final features.

---

## 17. Explicit non-goals for early implementation

Unless a later task explicitly changes the scope, early implementation must not silently expand into:

- a complete GTA-like game;
- full 3D building simulation;
- photorealism;
- server-side generative rendering infrastructure;
- global multiplayer;
- procedural mission generation;
- pedestrian simulation;
- traffic simulation;
- mobile optimization before the desktop baseline exists;
- premature city-scale streaming.

---

## 18. Rule for Codex

When implementing OpenGTA Web, Codex must treat this document as a constraint document.

If an implementation task appears to conflict with these principles, Codex should:

1. stop before introducing the conflicting architectural assumption;
2. identify the conflict;
3. explain the smallest decision that must be made;
4. propose alternatives;
5. wait for that decision when the choice would materially affect the architecture.

Codex must not convert an old draft hypothesis into an accepted decision merely because code can be written for it.

---

## 19. Relationship with other project documents

Document precedence should be interpreted as follows:

```text
Product intent / accepted product principles
            ↓
Accepted architecture principles
            ↓
ADR decisions
            ↓
Execution plans
            ↓
Individual Codex tasks
            ↓
Implementation details
```

When two documents conflict, the higher-level accepted constraint wins unless it has explicitly been superseded.

The original technical idea document remains valuable as a source of hypotheses, alternatives and future directions, but it must not override confirmed product intent or accepted architecture principles.

---

## 20. Current core principles — short form

Every future technical decision should remain compatible with these statements:

1. **Browser first.**
2. **Real geographic data is the basis of the world.**
3. **Two world modes: preprocessed and arbitrary-coordinate runtime.**
4. **One shared engine/runtime for both modes.**
5. **2D-first world, gameplay and collision model.**
6. **Fake 2.5D is preferred over expensive true 3D.**
7. **AI enriches visuals; it does not define world truth.**
8. **Runtime AI must be optional and preferably client-side.**
9. **Weak devices must degrade gracefully where practical.**
10. **Canonical world data must be independent from renderer and physics technology.**
11. **Important technologies remain replaceable until validated by ADR.**
12. **Performance decisions must be measured.**
13. **Codex implements small verified increments rather than guessing the architecture.**
