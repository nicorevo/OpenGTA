# ADR-007 — Public OSM Service Boundaries

**Status:** Accepted  
**Date:** 2026-08-19

## Decision

OpenGTA will not treat OSMF/community public endpoints as an unlimited
production backend merely because OpenStreetMap data itself is open.

## Rules

- V0 uses committed local fixture data.
- Public Nominatim is not a production dependency.
- Public OSM raster/vector tile services are not used to build offline world
  packages.
- Public Overpass may be used for bounded development/test acquisition, not as
  an assumed scale architecture.
- Provider endpoints stay behind project-owned interfaces.
- Product attribution is mandatory when OSM data is used.

## Reason

OSMF service usage policies impose capacity, rate, caching, attribution and in
some cases no-bulk-download restrictions independent of the ODbL data license.
