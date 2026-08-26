# Road Surface Generation V0

**Status:** Normative compiler behavior for first slice

## Input

`RoadFeature.centerline` plus width semantics.

## Width selection

Priority:

1. valid explicit `widthMeters`;
2. valid `laneCount × 3.0 m`;
3. road-class fallback.

V0 fallback table:

```text
motorway       12.0 m
trunk          10.0 m
primary         9.0 m
secondary       8.0 m
tertiary        7.0 m
residential     6.0 m
service         4.0 m
pedestrian      4.0 m
path            2.0 m
parking-aisle   3.5 m
unknown         5.0 m
```

These widths are rendering/gameplay fallbacks, not claims about actual road
dimensions.

## Carriageway fitting

The selected width is an upper bound, not the emitted width.

Real OSM footprints in a historic centre sit closer than the class fallback, so
a nominal carriageway would be painted inside the buildings that line it. The
compiler probes the free gap on both sides of the centerline and narrows the
road to the lower quartile of the measured gaps, clamped to a minimum
carriageway so alleys stay part of the network.

Rules:

- footprints stay authoritative: the canonical world model is never modified;
- fitting may only narrow a road, never widen it;
- a road whose centerline runs under a building collapses to the minimum and the
  compiler emits an aggregate diagnostic;
- the result is one width per road, so the drawn path stays homogeneous.

Measured on the Lecce fixture (355 roads, 164 buildings): the nominal widths put
23% of the network edge inside a building, the median gap leaves 19%, and the
lower quartile leaves 13% while collapsing only 5 roads to the minimum. 4% of
the network has its centerline genuinely under a building — mostly covered
pedestrian passages — which fitting cannot fix.

## Geometry

Generate a 2D strip centered on the polyline.

V0 join policy:

- interior vertices emit both incoming and outgoing offsets (bevel join), so the
  strip edge follows every bend instead of cutting the corner;
- collinear vertices must not duplicate offsets;
- butt caps are acceptable at clipped/fixture boundaries;
- avoid unbounded miter spikes;
- self-intersection on the inner side of a bend is accepted and must not crash
  the compiler.

The compiler must emit diagnostics for pathological input.

The compiler also emits `centerline` and `widthMeters` so a renderer can stroke
the carriageway network directly.

## Rendering

Initial road style can be:

- flat asphalt-like fill;
- optional simple edge;
- no lane marking requirement.

The network must read as one continuous path, not as a chain of overlapping
quads. V0 renderer policy:

1. stroke all road casings first, then all asphalt, so a casing never crosses a
   neighbouring carriageway at a junction;
2. use round joins and caps;
3. paint narrow classes before wide ones;
4. keep the casing width proportional to the road width, so narrow alleys are
   not swallowed by their own edge;
5. buildings render above roads, but must not cover the carriageway: the
   building layer is masked by the drawn corridor, so a road is never
   interrupted by a building.

Point 5 alters buildings visually where the two still overlap. That is a
presentation decision: the compiled footprint and the collision walls keep the
source geometry.

The goal is geographic readability, not final art.

## Collision

Road surfaces themselves do not create solid collision.

## Later

Lane topology, sidewalks, intersections and traffic navigation are downstream
features, not V0 road-surface requirements.
