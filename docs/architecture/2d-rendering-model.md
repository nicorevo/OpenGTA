# OpenGTA Web — 2D Rendering Model

**Status:** Architecture design baseline  
**Date:** 2026-08-19  
**Depends on:**  
- `product-architecture-principles.md`  
- `dual-world-pipeline.md`  

**Purpose:** Define the visual and rendering model for OpenGTA Web as a 2D-first top-down game with optional low-cost fake-2.5D effects, without committing yet to a specific rendering library.

---

## 1. Visual target

OpenGTA Web must be visually structured as a **top-down 2D world**, inspired by the spatial readability of the first Grand Theft Auto games.

The goal is not to reproduce their exact look, assets, palette or implementation.

The intended visual principle is:

```text
Geographic truth remains 2D
        ↓
Renderer adds inexpensive visual depth cues
        ↓
Player perceives a richer 2.5D scene
```

The game must not require a fully modeled 3D city in order to look dimensional.

---

## 2. Canonical rendering principle

The architectural rule is:

```text
WORLD DATA      = 2D-first
GAMEPLAY SPACE  = 2D-first
COLLISION SPACE = 2D-first
CAMERA LOGIC    = top-down
VISUAL DEPTH    = optional / artificial / inexpensive
```

True 3D geometry is allowed only where profiling later demonstrates that it is simpler or cheaper than an equivalent fake-2.5D solution.

It must never become a silent default.

---

## 3. Camera model

The camera should remain fundamentally top-down.

Preferred properties:

- stable top-down orientation;
- no perspective dependency for gameplay;
- no need for 3D camera movement to reveal building height;
- world readability should remain strong at all supported zoom levels;
- camera logic should not affect collision or world truth.

A renderer may internally use an orthographic 3D camera or a technical Z axis, but this must remain an implementation detail.

The visual appearance of a building facade should preferably be produced by the building rendering method rather than by strongly tilting the camera.

---

## 4. World rendering layers

The renderer should conceptually separate the scene into logical layers.

Recommended initial model:

```text
L0 — ground / terrain
L1 — roads and road markings
L2 — sidewalks / paved areas
L3 — static ground decoration
L4 — building bases / footprints
L5 — dynamic entities
L6 — building roofs / fake facades / foreground occluders
L7 — elevated decoration / tree canopies / signs
L8 — effects
L9 — UI / HUD
```

This ordering is conceptual.

The final renderer may implement it through:

- explicit render layers;
- batches;
- z-order values;
- render groups;
- sorted sprite lists;
- depth buffers;
- hybrid techniques.

The important requirement is deterministic visual ordering.

---

## 5. Building representation

A building is primarily a 2D geographic footprint.

Conceptually:

```text
BuildingVisual
├── footprint
├── roof representation
├── facade representation
├── visualHeight
├── shadow representation
├── style metadata
└── occlusion metadata
```

The footprint is authoritative.

The facade, height and shadow are visual derivatives.

---

## 6. Fake building height

The preferred initial strategy is to fake height without creating a complete 3D mesh.

A simple conceptual model:

```text
base footprint
      ↓
project/offset roof
      ↓
connect selected edges visually
      ↓
draw facade strip
      ↓
optional shadow
```

For example:

```text
        roof
   ┌───────────┐
   │           │
   └───────────┘▒
       ▒▒▒▒▒▒▒▒
       facade
```

Possible techniques:

- screen-space roof offset;
- projected facade polygon;
- precomputed facade strip;
- texture-projected facade;
- layered sprite composition;
- pre-baked building sprite;
- simple shadow projection.

The renderer should be capable of selecting a cheaper technique on weaker devices.

---

## 7. Visual height

Building height should initially be interpreted as rendering metadata.

Possible sources:

- explicit source-data height;
- building level count;
- style defaults;
- region defaults;
- deterministic fallback;
- offline enriched metadata.

Conceptual field:

```ts
visualHeight?: number;
```

Its unit is not yet fixed.

It may eventually represent:

- source meters;
- normalized style tiers;
- projected screen pixels;
- another renderer-neutral value.

The canonical world model should preserve source information without forcing one renderer-specific interpretation.

---

## 8. Building facades

A facade does not need to be a physically modeled wall.

Possible representation:

```text
roof edge
   +
projection vector
   ↓
2D quadrilateral
   ↓
facade texture/material
```

For a polygonal building, not every edge must necessarily produce a visible facade.

The renderer may derive visible facade edges from:

- fixed projection direction;
- camera orientation;
- roof offset direction;
- precomputed visibility rules.

This is a visual problem, not a world-geometry problem.

---

## 9. Building occlusion

Buildings must be able to visually occlude vehicles, pedestrians and lower-layer objects where appropriate.

This may be handled through:

- ordered layers;
- per-building roof/facade pass;
- masks;
- depth values;
- local sorting;
- renderer-specific depth testing.

The initial implementation should prefer a simple deterministic method over complex per-pixel solutions.

A key design target is:

```text
car passes behind visual facade
→ car becomes partially or fully hidden
→ physics remains unchanged
```

Occlusion must not require a 3D physics volume.

---

## 10. Roads

Roads should be represented as 2D geometry derived from road centerlines and metadata.

Conceptually:

```text
road centerline
    + width
    + road class
    + surface/style
        ↓
road polygon
        ↓
render batch
```

Possible visual elements:

- asphalt surface;
- road edge;
- lane markings;
- crossings;
- parking markings;
- sidewalks;
- medians;
- decorative details.

The first prototype should prioritize structural readability over detailed road art.

---

## 11. Ground and land-use areas

Ground categories may include:

- grass;
- water;
- paved areas;
- pedestrian zones;
- sand;
- industrial surfaces;
- generic terrain;
- undefined fallback.

These should generally be rendered as:

- large polygon batches;
- tiled textures;
- procedural fills;
- preprocessed background tiles.

They should not become collections of independent objects unless interaction requires it.

---

## 12. Static background baking

Preprocessed World Mode may use aggressive background baking.

Candidate static content:

```text
roads
sidewalks
grass
water
non-interactive markings
small decoration
static terrain detail
```

may be combined into larger prepared visual surfaces.

Conceptually:

```text
STATIC BACKGROUND LAYER
        +
INTERACTIVE WORLD LAYER
```

This can reduce:

- draw calls;
- runtime geometry count;
- state changes;
- CPU sorting cost.

The runtime mode may produce a similar result dynamically or use more granular primitives.

Both approaches must preserve compatible gameplay/world semantics.

---

## 13. Dynamic entities

Vehicles, pedestrians and movable gameplay objects should initially be treated as 2D dynamic entities.

Possible render representations:

- sprite;
- sprite atlas animation;
- directional sprite set;
- procedurally composed sprite;
- simple polygon representation.

The first vehicle prototype should not require a full 3D vehicle model.

Vehicle physics orientation and sprite orientation should share the same planar angle.

---

## 14. Vehicle directional rendering

A vehicle can be represented through:

### Option A — rotating sprite

```text
single top-down sprite
→ GPU rotation
```

Advantages:

- simplest;
- low asset count;
- smooth arbitrary rotation.

Potential issue:

- may look visually flat depending on art style.

### Option B — directional sprite atlas

```text
8 / 16 / 32 direction frames
```

Advantages:

- richer fake perspective;
- can show side details.

Costs:

- more asset memory;
- frame selection logic;
- potentially visible direction transitions.

### Option C — hybrid

Base sprite rotation plus direction-dependent overlays.

No option is accepted yet.

The renderer ADR should evaluate them.

---

## 15. Pedestrians

Pedestrians should remain optional for later phases.

When introduced, preferred representation is:

- sprite atlas;
- directional frames or sprite rotation;
- simple 2D collision shape;
- independent animation state.

No skeletal 3D character pipeline should be assumed.

---

## 16. Trees and vertical decorative objects

Objects such as:

- trees;
- poles;
- signs;
- lamps;
- hydrants;
- kiosks;

should preferably use sprites or layered sprites.

For trees, a useful model may be:

```text
trunk/base interaction layer
        +
canopy visual layer
```

This permits vehicles and pedestrians to pass visually under part of the canopy while retaining simple collision rules.

---

## 17. Shadows

Shadows should be treated as a visual enhancement, not a simulation requirement.

Preferred initial options:

- baked shadows;
- simple projected blob shadows;
- precomputed building shadows;
- fixed-direction polygon shadows;
- sprite shadows.

Avoid early dependence on:

- dynamic multi-light shadow maps;
- physically based lighting;
- expensive per-object shadow rendering.

A day/night cycle may later alter shadow direction or intensity, but it is outside the first rendering validation.

---

## 18. Lighting

The first renderer does not require physically correct lighting.

Preferred initial strategy:

```text
base textures/colors
        +
global tint / palette
        +
optional cheap effects
```

Possible later additions:

- day/night global tint;
- vehicle headlights;
- emissive windows;
- street lights;
- weather overlays.

Lighting should remain compatible with batched 2D rendering.

---

## 19. Texture strategy

The architecture should support both:

### Preprocessed assets

- baked city textures;
- region-specific atlases;
- AI-generated or curated texture sets;
- compressed downloadable packages.

### Runtime assets

- generic deterministic texture library;
- procedural color/material rules;
- optional locally generated AI textures;
- local caching of generated assets.

The renderer must always have a non-AI fallback.

---

## 20. Texture atlases

Texture atlases are a strong candidate because the scene may contain many repeated visual categories.

Potential atlas groups:

```text
roads
buildings
roofs
facades
vehicles
props
vegetation
effects
```

Benefits to validate:

- reduced draw calls;
- reduced texture switching;
- compact distribution;
- simpler batching.

Atlas size, compression format and paging strategy are not yet decided.

---

## 21. AI visual enrichment

AI-generated visuals should integrate downstream from deterministic style resolution.

Possible pipeline:

```text
building metadata
        ↓
deterministic style category
        ↓
optional AI enrichment request
        ↓
generated visual asset
        ↓
local cache
        ↓
renderer
```

For example:

```text
region: Lecce
building: historic
surface/material hints: stone
        ↓
visual descriptor
        ↓
texture variant
```

AI should not modify:

- footprint;
- road topology;
- collision geometry;
- world coordinates.

---

## 22. Rendering batches

The renderer should be evaluated primarily on its ability to render large numbers of 2D primitives efficiently.

Preferred batching categories may include:

```text
ground polygons
road polygons
building roofs
building facades
static sprites
dynamic sprites
effects
```

Avoid one heavyweight render object per OSM feature if a batch representation can preserve behavior.

The architecture should favor data-oriented rendering over deep per-object scene graphs.

---

## 23. Render object lifetime

The canonical world model should outlive renderer-specific resources.

Preferred relationship:

```text
CompiledChunk
    ↓ activate
RendererAdapter creates GPU/runtime resources
    ↓ deactivate
RendererAdapter releases GPU/runtime resources

CompiledChunk remains cacheable independently
```

Renderer resources must not become the authoritative world state.

---

## 24. Sorting strategy

Because the world is 2D-first, visual ordering must be deterministic and cheap.

Candidate strategies include:

- fixed layer order;
- entity Y-sort;
- Y-sort only inside a layer;
- explicit sort keys;
- precomputed static ordering;
- hybrid depth buffer.

The first implementation should avoid globally sorting every primitive every frame.

Static objects should be sorted or grouped once where possible.

Dynamic entities should have a bounded sorting cost.

---

## 25. Coordinate spaces

The rendering architecture should distinguish:

```text
GEOGRAPHIC SPACE
lat/lon

LOCAL WORLD SPACE
meters or normalized local units

RENDER SPACE
renderer coordinates

SCREEN SPACE
pixels
```

Conversion responsibilities must remain explicit.

Fake-2.5D offsets should ideally occur in render space or screen-derived visual space rather than altering geographic world truth.

---

## 26. Zoom behavior

The top-down renderer must eventually support multiple zoom levels.

At different zoom levels the engine may reduce detail.

Conceptually:

```text
near
- detailed road markings
- detailed roofs/facades
- props
- vehicles/pedestrians

medium
- simplified facades
- reduced props
- simplified markings

far
- roof/building blocks
- major roads
- minimal decoration
```

This can act as a 2D equivalent of LOD.

Exact thresholds must be benchmarked later.

---

## 27. 2D LOD

LOD does not require 3D mesh simplification.

Possible 2D LOD strategies:

- polygon simplification;
- removal of small decoration;
- texture substitution;
- sprite substitution;
- background baking;
- road-detail reduction;
- feature aggregation;
- reduced facade depth.

Preprocessed World Mode can generate these ahead of time.

Runtime mode may use deterministic simplified rules.

---

## 28. Mobile and slow-device compatibility

Although mobile is not part of the first technical validation, renderer choices should not structurally prevent later degradation.

Possible low-cost mode:

```text
- no AI
- no dynamic shadows
- simpler facade effects
- fewer decorative sprites
- lower-resolution textures
- lower internal render resolution
- more aggressive static baking
```

The renderer should allow feature disabling without changing the canonical world model.

---

## 29. Rendering quality tiers

Conceptual tiers:

```text
LIGHTWEIGHT
- flat 2D
- basic roofs
- static/simple shadows
- low texture resolution

STANDARD
- fake facades
- richer textures
- more props
- improved shadows

ENHANCED
- richer procedural effects
- additional visual layers
- optional local AI assets
```

These names are internal placeholders.

Actual user-facing quality settings are not defined.

---

## 30. Renderer technology evaluation criteria

A later ADR should compare candidate renderers using concrete tests.

Evaluation criteria must include:

### Performance

- frame time;
- draw calls;
- batch count;
- texture switches;
- memory use;
- upload cost;
- large-world scrolling cost.

### Feature fit

- sprite batching;
- arbitrary 2D polygons;
- texture atlases;
- masking;
- layer ordering;
- render-to-texture;
- offscreen/background baking;
- shader support;
- worker-friendly data pipeline;
- orthographic/fake-2.5D support if needed.

### Engineering

- bundle size;
- browser support;
- mobile support;
- API complexity;
- maintenance;
- ecosystem;
- license;
- debugging tools;
- TypeScript quality.

### Architectural fit

- does not require the canonical model to become 3D;
- can consume compiled chunk data efficiently;
- can release resources per chunk;
- supports deterministic degradation.

---

## 31. Candidate renderer classes

This document does not select a renderer.

Potential classes to evaluate:

```text
2D-focused WebGL/WebGPU renderer
general-purpose 3D renderer used in orthographic 2D mode
custom low-level WebGL/WebGPU layer
Canvas2D fallback/prototype
```

Named technologies should be evaluated in a dedicated ADR rather than accepted here.

---

## 32. Physics independence

The visual model must not require the physics system to mirror fake depth.

Example:

```text
visual:
building appears 12 px high

physics:
single 2D footprint collider
```

Likewise:

```text
visual:
tree canopy overlaps road

physics:
small trunk collider or no collider
```

Renderer and physics adapters must consume the same world semantics but may represent them differently.

---

## 33. Debug rendering mode

The engine should eventually include a deterministic debug view.

Useful toggles:

```text
show building footprints
show road centerlines
show collision polygons
show chunk bounds
show feature IDs
show render layers
show sprite bounds
show visual-height vectors
show occlusion order
```

A debug renderer is important because fake-2.5D can otherwise hide structural errors.

---

## 34. First rendering vertical slice

The first rendering implementation should prove only:

1. one fixed geographic dataset can be displayed;
2. roads are recognizable;
3. buildings are recognizable;
4. buildings use 2D footprints;
5. at least one fake-height technique can be demonstrated;
6. one vehicle can move in the scene;
7. vehicle/building collision remains 2D;
8. renderer performance can be measured;
9. no AI is required;
10. no live world streaming is required.

Suggested first visual target:

```text
flat ground
+ road polygons
+ building roof polygons
+ one inexpensive facade/shadow effect
+ vehicle sprite
```

---

## 35. What the first rendering prototype must not do

Do not introduce unless required by a specific later decision:

- full 3D building meshes;
- perspective gameplay camera;
- dynamic shadow maps;
- PBR materials;
- skeletal animation;
- 3D vehicles;
- 3D pedestrians;
- complex lighting;
- city-scale streaming;
- runtime AI dependency;
- multiple art pipelines;
- final texture atlas format.

---

## 36. Codex rules for rendering tasks

When Codex implements rendering work:

1. Treat world geometry as 2D-first.
2. Do not create true 3D buildings by default.
3. Keep renderer-native objects outside the canonical world model.
4. Keep fake depth visual-only unless a gameplay requirement explicitly says otherwise.
5. Prefer batching over one render object per source feature.
6. Avoid expensive per-frame sorting of static data.
7. Keep AI optional.
8. Preserve a deterministic non-AI rendering path.
9. Make quality features individually disableable.
10. Add measurements when making performance claims.
11. Do not select a renderer permanently without an ADR.
12. If a candidate library forces the world model toward full 3D, report that as an architectural concern.

---

## 37. Open design questions

Still unresolved:

- Which renderer best matches this workload?
- Should building fake height use roof offset, facade projection, sprite baking, or a hybrid?
- Should facade generation happen offline, at chunk compile time, or at render time?
- How should concave footprints be handled visually?
- How should holes/courtyards be rendered?
- Should static terrain be polygon-batched or baked into textures?
- What is the best sorting method for buildings and vehicles?
- Is a technical depth buffer beneficial even with a 2D-first model?
- What zoom ranges should trigger 2D LOD?
- Which texture compression formats are acceptable?
- Should runtime-generated AI textures be atlas-packed dynamically?
- How should cached AI assets be versioned?
- What is the lowest-cost renderer path for weak devices?
- How much fake depth can be retained before it starts hurting readability?

These should be addressed through experiments and ADRs.

---

## 38. Benchmark scenarios to prepare later

The renderer ADR should not rely on synthetic microbenchmarks only.

At minimum, prepare representative scenes:

### Scene A — sparse suburb

- few large buildings;
- wide roads;
- low object density.

### Scene B — dense historic center

- many irregular footprints;
- narrow roads;
- courtyards;
- high visual density.

### Scene C — modern grid

- repeated building types;
- regular roads;
- many vehicles.

### Scene D — stress case

- intentionally high feature density;
- many visible chunks;
- large sprite count.

Measure each candidate renderer using equivalent visual output.

---

## 39. Decision summary

Accepted by this document:

- final presentation is top-down 2D-first;
- fake 2.5D is preferred over true 3D;
- building footprint is authoritative;
- facade/height/shadow are visual derivatives;
- roads are 2D geometry;
- vehicles are initially 2D dynamic entities;
- rendering should favor batching;
- static preprocessed worlds may aggressively bake visuals;
- runtime worlds must retain a deterministic low-cost visual path;
- AI is optional downstream enrichment;
- quality must degrade without changing world truth;
- renderer selection remains open.

Not accepted by this document:

- renderer library;
- physics library;
- camera implementation details;
- exact fake-height algorithm;
- exact sort algorithm;
- texture atlas format;
- compression format;
- final art style;
- final quality tiers;
- final zoom/LOD thresholds.
