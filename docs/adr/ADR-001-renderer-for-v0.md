# ADR-001 — Renderer for V0

**Status:** Accepted for prototype  
**Date:** 2026-08-19

## Decision

Use **PixiJS v8 with WebGL** for V0.

This is not a permanent renderer commitment.

## Rationale

The product workload is explicitly 2D-first:

- sprites;
- arbitrary 2D polygons;
- layer ordering;
- fake-2.5D;
- texture atlases;
- render-to-texture/static baking.

PixiJS describes itself as a 2D rendering engine and currently documents
WebGL/WebGL2 as its default/stable recommended renderer.

Its WebGPU renderer exists but is still described as maturing/experimental due
to browser inconsistencies, so WebGPU is not the V0 baseline.

## Architectural constraint

PixiJS types remain under the renderer adapter/module.

Canonical World Model and CompiledChunk semantic contracts do not contain
PixiJS objects.

## V0 validation

Implementation must still measure:

- scene object count;
- frame metrics;
- fake facade behavior;
- resource destruction/recreation;
- dense fixture behavior.

## Exit criteria

Benchmark Three.js orthographic or a lower-level renderer only if V0 evidence
shows a material PixiJS limitation.

Do not maintain two complete renderers without evidence.

## Sources checked 2026-08-19

- https://pixijs.com/8.x/guides/getting-started/intro
- https://pixijs.com/8.x/guides/components/renderers
- https://pixijs.com/8.x/guides/concepts/render-loop
