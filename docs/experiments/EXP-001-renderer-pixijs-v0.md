# EXP-001 — PixiJS renderer fit for OpenGTA V0

**Status:** Ready to run after base scaffold  
**Primary ADR:** ADR-001  
**Model class:** STANDARD for implementation, FRONTIER only for analysis if the
result is ambiguous.

## Question

Can PixiJS v8 render the OpenGTA 2D/fake-2.5D workload cleanly without forcing
a per-feature heavyweight scene architecture?

## Fixed backend

Use PixiJS WebGL for the baseline experiment.

Do not compare WebGPU yet.

## Scene

Generate or load deterministic synthetic/canonical data representing:

- ground;
- at least several hundred road/building polygons;
- irregular building footprints;
- a small number of holes/courtyards if supported by the chosen primitive;
- one fake facade/roof-offset technique;
- one rotating vehicle sprite or simple placeholder quad;
- debug layer.

This is a renderer experiment, not a complete OSM pipeline.

## Required implementation paths

Keep renderer objects under:

```text
src/render/
```

Input must be renderer-neutral compiled data.

## Compare two Pixi approaches

Within PixiJS only:

### A — many `Graphics` scene objects

Simple baseline.

### B — grouped/batched geometry or Mesh-based static representation

Use a more data-oriented path where appropriate.

The purpose is to measure whether scene-object count becomes a concern.

## Metrics

Record:

- initialization time;
- frame time average/p95;
- visible feature count;
- scene object count;
- draw calls/batches if observable;
- JS heap estimate;
- canvas resolution;
- browser/GPU/CPU.

## Visual checks

- roads/buildings recognizable;
- fake facade has correct deterministic ordering;
- vehicle can pass visually behind/near facade;
- zoom/pan does not break geometry;
- no true 3D camera required.

## Success

EXP-001 succeeds if:

1. the scene is structurally simple to implement;
2. fake-2.5D does not require abandoning the 2D-first model;
3. measured performance leaves substantial V0 headroom;
4. chunk-like static groups can be destroyed/recreated cleanly.

## Failure/benchmark trigger

Prepare a focused Three.js orthographic comparison only if one of these occurs:

- polygon handling is materially awkward;
- object overhead is measurable at representative density;
- fake facade/occlusion requires disproportionate custom work;
- required batching cannot be achieved reasonably.

Do not implement a full Three.js branch without such evidence.
