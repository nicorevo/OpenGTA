# OpenGTA Web — Performance and Capability Tiers

**Status:** Measurement baseline  
**Date:** 2026-08-19

## 1. Principle

"Fast", "lightweight" and "fluid" are not measurable requirements.

Every optimization claim must be linked to a repeatable scenario.

## 2. First target

V0 target class:

```text
desktop browser
mid-range PC
1920×1080
single fixed urban area
one player vehicle
```

Exact reference hardware must be recorded when benchmarks begin.

## 3. Provisional frame target

For design purposes only:

```text
60 FPS target
16.67 ms frame budget
```

This is a provisional target, not yet a product SLA.

Track:

- average frame time;
- p95 frame time;
- p99 frame time or 1% low equivalent;
- longest stall;
- CPU time where measurable;
- GPU time where measurable.

## 4. Loading metrics

Track separately:

```text
source decode
normalization
world-model creation
compile
renderer activation
physics activation
first playable
```

Do not report one opaque "load time" only.

## 5. Memory metrics

Track:

- JS heap;
- compiled chunk memory estimate;
- texture memory estimate;
- active chunk count;
- warm cache count;
- asset/model memory.

## 6. Rendering metrics

Track:

- draw calls;
- batches;
- visible sprites;
- visible polygons;
- triangle count when applicable;
- texture switches;
- render resolution;
- zoom level.

## 7. Representative scenes

Maintain at least four benchmark fixtures:

```text
A sparse suburb
B dense historic center
C regular modern grid
D stress case
```

All renderer/physics comparisons must use equivalent scene content.

## 8. Capability tiers

Internal target categories:

### Tier 0 — Preprocessed Lightweight
- preprocessed worlds;
- low resolution textures;
- minimal fake depth;
- no AI;
- aggressive baking.

### Tier 1 — Runtime Basic
- browser world compilation;
- deterministic visuals;
- no local AI.

### Tier 2 — Runtime Enhanced
- richer fake depth;
- more decoration;
- more complex shaders/effects.

### Tier 3 — Runtime AI
- optional local AI descriptor/texture enrichment.

These are architecture labels, not final UI names.

## 9. Degradation order

When performance is insufficient, degrade in this order where practical:

1. optional AI;
2. decorative effects;
3. shadow complexity;
4. facade complexity;
5. decoration density;
6. texture resolution;
7. internal render resolution;
8. active/prefetch radius.

Do not degrade collision/world truth first.

## 10. Benchmark gates

A technical choice becomes accepted only when:

- feature fit is proven;
- benchmark scene is reproducible;
- regression metrics are stored;
- failure mode is understood.

## 11. Performance regression

Codex tasks that materially affect hot paths should add or update a benchmark.

No "optimization" PR should be accepted solely from intuition.

## 12. V0 acceptance

V0 should produce a machine-readable or easily copied benchmark summary.

Example fields:

```text
browser
OS
CPU
GPU
resolution
fixture
frame average
p95 frame
max stall
compile time
first-playable time
memory estimate
draw calls
```
