# EXP-003 — Bounded local metric projection

**Status:** Ready after base scaffold  
**Primary ADR:** ADR-003  
**Model class:** STANDARD

## Question

Is a simple local projection sufficiently accurate for the bounded V0 fixture?

## Implement

Behind `GeoProjector`:

```text
toLocal(geo, origin)
toGeo(local, origin)
```

Use:

```text
+X east
+Y north
```

and local meter-like values.

## Fixture

Choose several known point pairs inside the future V0 area:

- near origin;
- east/west pair;
- north/south pair;
- diagonal pair;
- pair near the maximum intended fixture radius.

## Record

- reference distance;
- projected Euclidean distance;
- absolute error;
- relative error;
- round-trip coordinate error;
- maximum fixture radius.

## Gate

If error is immaterial for building/road geometry and arcade vehicle distances,
keep the simple projector for V0.

If not, replace the implementation behind the same interface.

## Non-goal

Do not solve global open-world projection/rebasing in this experiment.
