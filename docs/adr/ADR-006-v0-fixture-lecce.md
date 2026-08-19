# ADR-006 — V0 Real-World Fixture: Lecce Historic Centre

**Status:** Accepted for prototype  
**Date:** 2026-08-19

## Decision

Use a bounded area of Lecce historic centre around Piazza Sant'Oronzo as the
first real-world fixture.

This is a developer/test fixture, not a restriction on the final product.

## Center

Working center:

```text
latitude  40.3531688889
longitude 18.1725900000
```

This is based on the published coordinate for Piazza Sant'Oronzo.

## Bounds

The test box is defined as ±300 local metres from the working center using the
V0 local metric projection:

```text
south 40.3504671945
west  18.1690586064
north 40.3558705833
east  18.1761213936
```

Nominal local bounds:

```text
x = -300 ... +300 m
y = -300 ... +300 m
```

## Why this area

A historic centre is useful because it naturally stresses:

- irregular building footprints;
- narrow/irregular streets;
- dense static geometry;
- courtyards/multipolygons;
- highly recognizable street structure.

A sparse suburb can be added later as a second benchmark fixture.

## Source

The eventual fixture data must come from OpenStreetMap-compatible source data
and preserve attribution/licensing metadata.

## Change rule

If source-data quality in this box makes V0 unnecessarily blocked by a rare OSM
edge case, Codex may propose a nearby replacement fixture of similar size and
density, but must not silently switch location.
