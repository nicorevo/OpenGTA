# OpenGTA Web — OSM Data and Attribution Notes

**Status:** Engineering/license integration note  
**Not legal advice.**  
**Checked:** 2026-08-19

## OSM data

OpenStreetMap data is published under the Open Data Commons Open Database
License (ODbL).

OpenGTA must attribute OpenStreetMap and its contributors when using the data.

## Code license vs data license

Do not treat an OSM-derived fixture/world database as if it automatically had
the same license as OpenGTA source code.

Keep provenance/license notices for data artifacts separately from code
licensing.

For example:

```text
src/fixtures/geo/lecce-sant-oronzo-v0.raw.json
src/fixtures/geo/lecce-sant-oronzo-v0.PROVENANCE.md
```

The provenance file should identify:

- OpenStreetMap contributors;
- ODbL;
- source endpoint/provider;
- fetch date;
- query/bounds;
- any transformation notes.

## User-facing attribution

Plan for visible attribution in the playable view or another presentation that
meets the OSM attribution guidelines for the medium.

Minimum product concept:

```text
© OpenStreetMap contributors
```

with appropriate license information/link where the platform permits.

Do not hide attribution as a developer-only note.

## Preprocessed packages

Because preprocessed world packages may be derived from OSM data, distribution
and share-alike implications must be reviewed before public release.

Keep the compiled world schema capable of carrying provenance/license metadata.

## Public OSM services

Open-data licensing does not mean public OSMF servers can be used without
limits.

Respect the separate usage policies for:

- Nominatim;
- raster tiles;
- vector tiles;
- other OSMF-operated services.

## Sources

- https://www.openstreetmap.org/copyright
- https://osmfoundation.org/wiki/Licence/Attribution_Guidelines
