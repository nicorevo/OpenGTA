# V0 Implementation Master Task

This file is a compact reference. Prefer the detailed handoff queue.

## End-to-end target

```text
committed Lecce OSM fixture
→ WGS84 local projector
→ normalization
→ Canonical World Model
→ World Compiler
→ PixiJS WebGL renderer
→ Rapier 2D static collision
→ arcade vehicle
→ top-down follow camera
→ debug/benchmark
```

## Required V0 result

A user can open the dev build, see a recognizable top-down slice of central
Lecce, drive one vehicle and collide with buildings.

Buildings show a modest fake-2.5D effect but remain planar in world/physics.

## Definition of Done

See:

`docs/execution/vertical-slice-v0.md`

and the more specific:

`docs/testing/v0-test-strategy.md`
`docs/testing/benchmark-protocol-v0.md`

No future-mode feature is required for V0 completion.
