# V0 Deterministic Visual Style Profile

**Status:** Required fallback style

V0 must look coherent without AI or final textures.

## Ground

- neutral low-detail base;
- land-use areas differentiated by simple fills.

## Roads

- dark neutral asphalt-like fill;
- no required lane markings;
- road hierarchy may vary brightness/width only if cheap.

## Buildings

- roof fill selected from a small deterministic palette/category;
- fake facade slightly darker than roof;
- optional simple projected shadow;
- no per-building generated texture required.

## Water

- distinct flat water fill.

## Park/grass

- distinct flat vegetation fill.

## Vehicle

- one clear top-down placeholder sprite/shape;
- visible heading.

## Principle

Readability beats art quality.

This profile exists so every richer style/AI path has a guaranteed fallback.
