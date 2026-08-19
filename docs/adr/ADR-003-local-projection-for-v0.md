# ADR-003 — Local Projection for V0

**Status:** Accepted for prototype  
**Date:** 2026-08-19

## Context

Gameplay needs meter-like local coordinates while source data uses WGS84
latitude/longitude.

V0 uses a bounded ~600 m × 600 m fixture.

## Decision

Use a project-owned `GeoProjector` abstraction.

The V0 implementation is a WGS84 tangent-linear local plane centered on the
fixture origin.

```text
+X = east
+Y = north
1 local unit = 1 metre
```

The exact mathematics and measured error are documented in:

`docs/research/projection-validation-lecce-v0.md`

## Validation result

Across a deterministic 7 × 7 grid covering the V0 fixture:

- 1176 point pairs tested;
- maximum tested distance ≈ 848.528 m;
- maximum absolute distance error ≈ 0.023946 m;
- maximum relative error ≈ 0.003991%.

This is accepted for V0.

## Rules

- WGS84 lat/lon remains persistent geographic identity.
- Raw degrees are never gameplay XY.
- Renderer screen-Y inversion happens only inside renderer/view conversion.
- Chunk dimensions do not enter projection mathematics.

## Upgrade path

For Open World Runtime, re-anchor local planes or replace the projector behind
the same abstraction when the supported radius makes this approximation
inappropriate.

This ADR does not define an unbounded global projection.
