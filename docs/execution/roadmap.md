# OpenGTA Web — Execution Roadmap

**Status:** Phase 0 closed; V0 executed; later phases gated
**Date:** 2026-08-19

Each phase ends with a gate. Do not begin a broad later phase merely because
individual code can already be written.

## Phase 0 — Documentation and contracts

Status: **complete**. Closeout: `docs/results/PHASE-0-COMPLETE.md`.
Index: `docs/architecture/README.md`. Current handoff: `docs/handoff/CURRENT.md`.

Deliverables:

- intent;
- architecture principles;
- dual pipeline;
- rendering model;
- canonical world model;
- coordinate model;
- world compiler;
- chunk/cache architecture;
- AI boundary;
- initial ADRs;
- Codex rules.

Gate:

> Codex can explain the architecture without inferring missing core rules.

## Phase 0B — Pre-code technology decision experiments

Deliver:

- TASK-D01 executable scaffold;
- EXP-003 bounded local projection;
- EXP-001 PixiJS WebGL renderer fit;
- EXP-002 Rapier 2D vehicle/collision fit;
- evidence-based ADR confirmation for the V0 stack.

Gate:

> Proposed technologies have enough evidence to become Accepted for prototype.

## Phase 1 — V0 deterministic vertical slice

Deliver:

- local fixture;
- coordinate projector;
- world model;
- compiler;
- PixiJS renderer;
- Rapier 2D collision;
- arcade vehicle;
- debug overlay;
- benchmark.

Gate:

> One fixed real area is recognizable and drivable with stable planar
> collision and measured performance.

## Phase 2 — Multi-chunk local streaming

Deliver:

- chunk lifecycle;
- neighboring local fixtures;
- activation/deactivation;
- cancellation;
- seam tests;
- memory budget.

Gate:

> Continuous driving across local chunk boundaries without visible or physical
> discontinuity.

## Phase 3 — Persistent compiled cache

Deliver:

- compiled schema/version;
- persistent cache experiment;
- invalidation;
- storage pressure fallback.

Gate:

> A previously compiled local area starts materially faster without breaking
> correctness after version changes.

## Phase 4 — Live geographic acquisition

Deliver:

- production-candidate source adapter;
- rate-control;
- provider errors;
- attribution;
- browser/proxy decision;
- source cache.

Gate:

> Arbitrary bounded coordinate request can become a playable deterministic
> area without manual fixture preparation.

## Phase 5 — Preprocessed World Packager

Deliver:

- offline compiler entry point;
- package manifest;
- static world distribution;
- integrity/version checks;
- quality variants.

Gate:

> The same runtime loads both locally compiled and offline packaged chunks.

## Phase 6 — Visual system

Deliver:

- texture atlases;
- regional deterministic style resolver;
- improved fake facades;
- 2D LOD;
- static background baking.

Gate:

> Visual quality improves without changing world truth or violating budget.

## Phase 7 — Client AI experiment

Deliver:

- capability check;
- optional descriptor generation;
- cache;
- cancellation;
- deterministic fallback;
- thermal/memory benchmarks.

Gate:

> AI adds visible value and can be fully disabled without breaking play.

## Phase 8 — Traffic and pedestrians

Deliver only after world streaming is stable.

## Phase 9 — Multiplayer

Before implementation, create dedicated ADRs for:

- authority;
- tick rate;
- transport;
- prediction/reconciliation;
- interest management;
- deterministic assumptions.

## Phase 10 — Mobile optimization

Use measured desktop architecture; do not fork engine.

## Continuous rule

At every phase:

```text
design
→ focused ADR if needed
→ small Codex task
→ tests
→ benchmark
→ accept/revise
```
