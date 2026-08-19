# Projection Validation — Lecce V0

**Date:** 2026-08-19  
**Result:** Sufficient for V0; ADR-003 may be accepted for prototype.

## Projection

The V0 projector uses a WGS84 tangent-linear approximation at the fixture
origin.

Given origin latitude `φ0` and longitude `λ0` in radians:

```text
e² = f (2 - f)

N = a / sqrt(1 - e² sin² φ0)

M = a (1 - e²) / (1 - e² sin² φ0)^(3/2)

x = (λ - λ0) N cos φ0
y = (φ - φ0) M
```

WGS84 constants:

```text
a = 6378137.0 m
f = 1 / 298.257223563
```

Inverse for the bounded V0 plane:

```text
φ = φ0 + y / M
λ = λ0 + x / (N cos φ0)
```

## Fixture center

```text
lat 40.35316888888889
lon 18.17259
```

## Nominal local box

```text
x -300 ... +300 m
y -300 ... +300 m
```

## Validation method

A deterministic 7 × 7 geographic grid covering the V0 box was generated.

All unique point pairs were compared:

```text
1176 pairs
```

Reference distance used WGS84 geodesic distance.

## Results

```text
maximum pair distance      ≈ 848.528 m
mean absolute error        ≈ 0.003003 m
95th percentile abs error  ≈ 0.011972 m
maximum absolute error     ≈ 0.023946 m
maximum relative error     ≈ 0.003991 %
```

For a 600 m-class V0 fixture, the error is far below the scale relevant to
road widths, building footprints and arcade vehicle collision.

## Decision

Use this projector in V0.

Do not promote it to an unbounded global projection.

Open World Runtime will use the same `GeoProjector` boundary but may re-anchor
local planes or replace the implementation when travel radius requires it.
