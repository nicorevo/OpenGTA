# ADR-004 — Geographic Data Source for V0

**Status:** Accepted for prototype  
**Date:** 2026-08-19

## Decision

V0 uses a **local deterministic real-world fixture**.

The working fixture is defined by ADR-006.

The application does not call Overpass, Nominatim or another live provider
during the core V0 run.

## Why

This isolates:

- source parsing;
- normalization;
- coordinates;
- world compiler;
- rendering;
- physics;

from:

- network failures;
- rate limits;
- upstream data changes;
- provider outages.

## Acquisition

A bounded OSM-derived response may be fetched once during fixture preparation
using the query under:

`docs/fixtures/lecce-v0/lecce-v0.overpassql`

The downloaded source then becomes a committed deterministic development
fixture with provenance and ODbL attribution.

## Architecture requirement

Keep:

```text
GeoDataSource
```

as an abstraction so later live/offline providers do not alter the canonical
world model.

## Production non-decision

This ADR does not select the production Open World provider.
