# OpenGTA Web — Chunking, Streaming and Cache Architecture

**Status:** Architecture design baseline  
**Date:** 2026-08-19

## 1. Purpose

Define responsibilities and invariants for spatial partitioning, progressive
loading and local reuse without fixing a final chunk size or storage
technology prematurely.

## 2. Chunk definition

A chunk is a runtime/distribution unit that can be independently:

- requested;
- compiled or downloaded;
- activated;
- deactivated;
- cached;
- discarded.

A chunk is **not** geographic truth.

Changing chunk size must not change feature identity.

## 3. Chunk states

Recommended lifecycle:

```text
ABSENT
→ REQUESTED
→ ACQUIRING
→ NORMALIZING
→ COMPILING
→ READY
→ ACTIVE
→ INACTIVE
→ CACHED / EVICTED
```

Preprocessed content may enter through:

```text
REQUESTED
→ DOWNLOADING
→ DECODING
→ READY
```

## 4. Active world window

The active world should be based on need, not a permanently fixed 3x3 grid.

Inputs may include:

- player position;
- player velocity;
- camera bounds;
- expected stopping distance;
- device capability;
- chunk load latency.

A fast car may require asymmetric look-ahead.

## 5. Chunk size

No final size is accepted.

The original 150 m hypothesis must be benchmarked against alternatives.

Suggested experiment set:

```text
128 m
256 m
512 m
```

These are benchmark candidates, not requirements.

Measure:

- request count;
- compile latency;
- serialized size;
- activation cost;
- memory;
- visible seam risk;
- wasted work when traveling quickly.

## 6. Feature ownership

Features crossing boundaries require explicit policy.

Possible strategies:

- owning chunk + references;
- clipped derived fragments + canonical parent ID;
- duplicated immutable render fragments;
- special large-feature layer.

Canonical features must remain identifiable independently of the strategy.

## 7. Streaming priorities

Suggested priority classes:

```text
P0 current playable area
P1 immediate movement direction
P2 visible camera neighbors
P3 nearby cache warm-up
P4 optional enrichment
```

Optional AI enrichment must always rank below structural playability.

## 8. First-play rule

Prefer:

```text
minimum playable area ready
→ start gameplay
→ prepare neighbors progressively
```

Do not block first interaction on complete city compilation.

## 9. Three cache levels

Conceptually:

### L1 — active memory
Runtime-ready chunks currently in use.

### L2 — warm memory
Recently used decoded/compiled chunks.

### L3 — persistent client cache
Serialized chunks/assets reusable across sessions.

Exact storage technologies remain open.

## 10. Preprocessed package distribution

Official/preprocessed worlds should be suitable for static/CDN distribution.

Desired characteristics:

- immutable/versioned package paths;
- integrity metadata;
- progressive chunk download;
- optional quality variants;
- compressed textures/assets;
- no server compute needed per ordinary load.

## 11. Runtime-generated cache

An open-world chunk generated locally should be cacheable.

Cache identity should eventually include:

```text
geographic cell identity
source revision
compiler version
coordinate model version
schema version
style version
quality profile
```

AI asset versioning may be separate.

## 12. Invalidation

Cache invalidation must be explicit.

Reasons may include:

- newer source data;
- compiler incompatibility;
- schema change;
- style change;
- corrupt entry;
- user storage pressure.

Fallback: discard and rebuild.

## 13. Storage pressure

Persistent caching is an optimization, not a requirement for correctness.

If storage is unavailable or quota is low:

```text
continue session
→ keep only memory cache
→ regenerate/re-download later
```

## 14. Predictive loading

Later optimization:

```text
player velocity vector
+ road topology
+ camera direction
→ likely next chunks
```

Do not implement predictive complexity before basic chunk lifecycle is stable.

## 15. Concurrency

Acquisition, compilation and enrichment need bounded concurrency.

Avoid:

```text
many neighbor chunks
× geometry compilation
× AI generation
→ device saturation
```

The scheduler should prioritize gameplay readiness.

## 16. Cancellation

All non-trivial work should be cancellable.

Highest-value cancellation targets:

- network acquisition;
- geometry compilation;
- texture generation;
- AI enrichment.

## 17. Seams

Chunk boundaries must not produce visible or physical discontinuities.

Tests should include:

- road crossing;
- building crossing;
- shadow/facade crossing;
- collision continuity;
- vehicle travel during activate/deactivate.

## 18. First implementation

V0:

- one fixed region;
- no streaming;
- compiler may still emit one or several logical chunks;
- chunk lifecycle API may be skeletal;
- no persistent cache required.

V1 streaming experiment:

- deterministic local fixtures;
- multiple neighboring chunks;
- no live provider yet.

## 19. Open decisions

- final chunk size;
- grid vs hierarchical cells;
- owning-feature policy;
- storage API;
- serialization;
- cache quota;
- prefetch radius;
- concurrency limits;
- eviction policy.

All require measurement.
