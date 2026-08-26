# OpenGTA Web — Codex Task Backlog

**Status:** P0 closed with Phase 0; V0 tasks executed in code; P7 still gated
**Date:** 2026-08-19

Model classes are defined in `../codex/model-routing.md`.

## P0 — Before code

### T001 Repository assessment
**Status:** done (2026-08-19). Observed: V0 application code exists; pre-code
docs were stale. Closeout in `docs/results/PHASE-0-COMPLETE.md`.

### T002 Reconcile docs/state
**Status:** done (2026-08-19). Current entry: `docs/handoff/CURRENT.md`.

## P1 — Coordinates and world model

### T010 Coordinate types + projector interface
**Model class:** STANDARD / medium  
**Read:** `coordinate-system.md`, ADR-003

### T011 V0 local projector + tests
**Model class:** STANDARD / medium  
**Read:** T010 files, ADR-003  
**Do not:** add global rebasing.

### T012 Canonical geometry/world types
**Model class:** STANDARD / medium  
**Read:** `world-model.md`

### T013 World-model invariant tests
**Model class:** ECONOMY / medium  
**Read:** only T012 files + tests.

## P2 — Fixture and normalization

### T020 Add deterministic fixture
**Model class:** ECONOMY / low  
**Do:** small representative real-area fixture.

### T021 Normalization pipeline
**Model class:** STANDARD / medium-high  
**Read:** world model, coordinate system, fixture.

### T022 Normalization edge-case tests
**Model class:** STANDARD / medium

## P3 — Compiler

### T030 Compiler contracts
**Model class:** STANDARD / medium  
**Read:** `world-compiler.md`

### T031 Road compiler
**Model class:** STANDARD / medium-high

### T032 Building compiler
**Model class:** STANDARD / high

### T033 Collision compiler
**Model class:** STANDARD / medium-high

### T034 Compiler diagnostics
**Model class:** ECONOMY / medium

## P4 — Renderer

### T040 PixiJS V0 adapter scaffold
**Model class:** STANDARD / medium  
**Read:** ADR-001, rendering model.

### T041 Ground/road batches
**Model class:** STANDARD / medium-high

### T042 Building roof + fake facade
**Model class:** FRONTIER / high  
**Reason:** first visually/architecturally sensitive rendering path.

### T043 Render/debug layers
**Model class:** STANDARD / medium

## P5 — Physics/vehicle

### T050 Rapier 2D adapter
**Model class:** STANDARD / medium  
**Read:** ADR-002.

### T051 Static building collisions
**Model class:** STANDARD / medium

### T052 Arcade vehicle controller
**Model class:** FRONTIER / high  
**Reason:** tuning + physics/gameplay tradeoffs.

### T053 Collision/debug tests
**Model class:** STANDARD / medium

## P6 — Integration and benchmark

### T060 Full V0 integration
**Model class:** FRONTIER / high  
**Read:** V0 plan + touched modules only.

### T061 Benchmark instrumentation
**Model class:** STANDARD / medium

### T062 V0 regression tests
**Model class:** STANDARD / medium-high

### T063 Documentation update
**Model class:** ECONOMY / low  
**Do:** update observed state; do not invent architectural decisions.

## P7 — After V0 only

### T100 Chunk lifecycle skeleton
**Model class:** STANDARD / medium-high

### T101 Multi-chunk local fixture test
**Model class:** STANDARD / medium-high

### T102 Cache experiment
**Model class:** STANDARD / medium

### T110 Live GeoDataSource research/ADR
**Model class:** FRONTIER / high

### T120 Offline package format/packager
**Model class:** FRONTIER / high

## Routing rule

Escalate from ECONOMY → STANDARD → FRONTIER only when:

- task ambiguity increases;
- cross-module architecture is required;
- debugging is non-local;
- visual/physics judgment is needed;
- initial model fails twice with a clear spec.

Do not use FRONTIER for boilerplate merely because it is available.
