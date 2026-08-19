# OpenGTA Web — Vertical Slice V0

**Status:** Ready for execution planning  
**Date:** 2026-08-19

## Goal

Prove one complete deterministic path from geographic fixture to drivable
top-down world.

## Scope

```text
local fixture
→ normalization
→ canonical world
→ compiler
→ PixiJS renderer
→ Rapier 2D adapter
→ one drivable vehicle
```

## Required visible result

A fixed real urban area where the player can:

- recognize roads/buildings;
- drive one vehicle;
- collide with buildings;
- observe one cheap fake-2.5D building effect.

## Required modules

1. coordinate projector;
2. fixture loader;
3. normalization;
4. canonical world types;
5. world compiler;
6. renderer adapter;
7. physics adapter;
8. vehicle controller;
9. debug overlay;
10. benchmark capture.

## Explicitly out of scope

- live OSM provider;
- arbitrary city search;
- streaming;
- persistent cache;
- AI;
- multiplayer;
- traffic;
- pedestrians;
- missions;
- mobile.

## Acceptance criteria

### Data

- fixture loads deterministically;
- malformed features are reported, not silently accepted;
- feature IDs are stable.

### Coordinates

- origin maps near `(0,0)`;
- cardinal directions are correct;
- distance error is documented;
- renderer does not consume lat/lon directly.

### World model

- buildings preserve footprint;
- roads preserve centerline;
- holes are preserved if present in fixture;
- no renderer/physics native objects in canonical types.

### Compiler

- road polygons generated;
- building roof/facade data generated;
- simple collision data generated;
- diagnostics produced.

### Renderer

- roads/buildings recognizable;
- fake facade/height visible;
- vehicle sprite rotates/moves;
- debug view can show bounds/collisions.

### Physics

- vehicle does not pass through ordinary building collision;
- stable at expected arcade speeds;
- collision remains 2D.

### Performance

Record:

- browser/OS;
- CPU/GPU;
- resolution;
- average/p95 frame time;
- longest visible stall;
- compile time;
- first-playable time;
- draw calls/batches when available;
- memory estimate.

## Definition of done

V0 is done when all acceptance criteria have a reproducible test or manual
procedure and the benchmark report is committed.
