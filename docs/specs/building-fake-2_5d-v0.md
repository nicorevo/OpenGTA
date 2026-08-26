# Building Fake-2.5D V0

**Status:** Normative first visual technique

## Goal

Make buildings read as slightly elevated while keeping world, gameplay and
collision planar.

## Input

```text
BuildingFeature.footprint
sourceHeightMeters?
sourceLevels?
buildingType
```

## Visual height fallback

Derive `visualHeightMeters`:

```text
sourceHeightMeters
else sourceLevels × 3.0 m
else 9.0 m
```

For `building=roof`, use a smaller/default effect and no solid building
collision.

## Screen-space depth magnitude

At render time:

```text
rawPx = visualHeightMeters × pixelsPerMeter × 0.60
depthPx = clamp(rawPx, 3 px, 24 px)
```

This intentionally compresses vertical scale.

It is an artistic depth cue, not geometric height.

## Direction

For north-up camera, use a fixed apparent elevation projection toward
north-west in screen/world presentation.

Conceptual normalized direction:

```text
(-0.707, +0.707) in canonical east/north orientation
```

Renderer converts to its screen-axis convention.

The exact sign may be flipped once during first visual review, but the
projection must remain globally consistent.

## Construction

1. render base/footprint if required by style;
2. translate a copy of the roof footprint by the visual depth vector;
3. create facade quads between base edge and translated roof edge for
   outward-facing silhouette edges;
4. render roof over facade;
5. optionally render one cheap shadow.

## V0 simplification

If silhouette-edge classification is not yet robust for a complex polygon:

- it is acceptable to generate facade quads for all outer edges;
- roof must render above them;
- record the artifact;
- do not replace the building with a true 3D mesh.

## Holes/courtyards

Preserve holes in roof geometry.

Inner courtyard facade depth is optional in V0.

## Collision

Use the canonical/base footprint only.

The translated roof/facade never changes collision.

## Occlusion

Vehicle sprite should be capable of appearing behind facade/roof visual layers
through deterministic render ordering.

Buildings must be painted in a deterministic painter order along the depth
direction: a building is drawn after the neighbour lying toward the extrusion
direction, so the neighbour's roof hides the shared wall. Without this order the
facade of one building paints a dark band across the roof of the next, which
reads as disorder in dense blocks.

Ties must resolve deterministically (stable feature identity), so the same chunk
always produces the same scene.

No 3D depth test is required.

## Success condition

The effect must be recognizable at normal gameplay zoom while remaining
visually modest and cheap.
