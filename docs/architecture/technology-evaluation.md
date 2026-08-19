# OpenGTA Web — Technology Evaluation Baseline

**Status:** Evaluation, not final selection  
**Date checked:** 2026-08-19

## Purpose

Turn the original stack proposal into explicit candidates and experiments.

Nothing in this document overrides the 2D-first product model.

## Renderer

### Leading candidate for the first experiment: PixiJS v8

Why it fits the workload:

- explicitly designed as a 2D web rendering engine;
- WebGL renderer is documented as the stable/recommended production path;
- WebGPU exists but is still subject to browser implementation inconsistencies;
- supports sprites, graphics/primitives, meshes, textures and batching-oriented
  rendering.

Why it is not final:

- dense OSM-derived polygon scenes must be benchmarked;
- fake facade/occlusion behavior must be prototyped;
- scene-graph overhead must be measured;
- Three.js orthographic/batched rendering remains a valid comparison.

### Alternative: Three.js

Keep as benchmark alternative, particularly if custom shaders, mesh batching or
technical 2.5D effects become simpler than in a 2D-first engine.

Do not choose it merely because it appeared in the original draft.

### Low-level WebGL/WebGPU

Do not start here.

Consider only if a higher-level renderer shows measured overhead or blocks a
critical rendering technique.

## Physics

### Leading candidate for first experiment: Rapier 2D

Rapier provides a JavaScript/WebAssembly 2D package and is compatible with a
planar world model.

Use only behind a project-owned adapter.

### Alternative: Planck.js or a simpler custom arcade collision layer

Benchmark if:

- WASM startup/bundle cost is material;
- the vehicle controller fights the generic physics solver;
- collision needs are simpler than expected.

The goal is arcade top-down vehicle feel, not automotive simulation.

## Geographic data

### V0

Use a deterministic local fixture.

### Later

Evaluate live OSM acquisition separately, including provider policies,
rate-limits, caching and attribution.

Do not couple the world model to Overpass or Nominatim.

## Coordinate projection

V0 may use a bounded local metric approximation behind `GeoProjector`.

The final open-world projection strategy remains open.

## Persistent cache

Keep the cache interface abstract until `CompiledChunk` serialization and
versioning are understood.

IndexedDB is a likely browser mechanism, not an accepted architecture truth.

## AI runtime

No AI runtime is selected.

First AI experiment should preferably output compact visual descriptors before
attempting client-side image generation.

## Decision rule

A candidate can move to `Accepted for prototype` only after:

1. a focused prototype exists;
2. representative fixture is used;
3. relevant alternatives are understood;
4. measurable exit criteria are recorded;
5. no higher-level principle is violated.
