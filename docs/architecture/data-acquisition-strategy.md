# OpenGTA Web — Geographic Data Acquisition Strategy

**Status:** Architecture baseline  
**Research checked:** 2026-08-19

## 1. Separate data from community services

OpenStreetMap data is open under ODbL, but OSMF-operated public services have
their own capacity/usage policies.

Therefore:

```text
OSM DATA LICENSE
!=
UNLIMITED RIGHT TO USE EVERY PUBLIC OSM SERVICE
```

OpenGTA must separate the data model from provider endpoints.

## 2. V0

Use a committed local fixture only.

No network dependency during V0.

## 3. Preprocessed World Mode

Preferred direction:

```text
regional/raw OSM data source
→ offline ingestion
→ World Compiler
→ OpenGTA world packages
→ CDN/static distribution
```

Do not build offline/preprocessed world packages by bulk downloading
`tile.openstreetmap.org` or OSMF vector tiles.

Those public tile services explicitly prohibit bulk/offline prefetch use.

Use raw OSM extracts or another provider whose terms permit the required
workflow.

## 4. Open World Runtime Mode

Production architecture:

```text
GeoDataSource interface
        ↓
provider selected by configuration
        ↓
bounded raw/vector feature request
        ↓
client normalization/compiler
```

The provider endpoint must be replaceable without a client software rewrite
where practical.

## 5. Overpass

Public Overpass instances are useful for:

- development;
- bounded testing;
- small-volume experiments.

They are shared infrastructure with load-shedding/rate limits and no product
SLA.

Do not make a successful V0 Overpass request evidence that the same endpoint is
a production-scale backend.

Production options later include:

- provider with explicit commercial/volume terms;
- a project-managed proxy/cache where terms permit;
- self-hosted regional ingestion;
- pre-generated/raw regional packages.

## 6. Nominatim

The public `nominatim.openstreetmap.org` service has strict usage rules.

Current OSMF policy includes:

- absolute maximum 1 request/second;
- identifiable Referer/User-Agent;
- attribution;
- caching expectations;
- no client-side autocomplete;
- product must be able to switch service;
- public API is not a generic geocoding service for arbitrary high-volume use.

Therefore:

### V0

No Nominatim.

### Future city search

Keep a `PlaceSearchProvider` abstraction separate from `GeoDataSource`.

Do not hard-wire public Nominatim into the product UI.

## 7. OSM raster/vector tiles

OpenGTA does not need OSM-rendered tiles as world truth.

The engine needs vector/geographic features.

OSMF raster/vector tile services explicitly prohibit bulk downloading for
offline packages.

Therefore tiles may be useful as optional developer/reference maps, but they
are not the preprocessed-world acquisition strategy.

## 8. Attribution

Attribution requirements belong to the product regardless of which mode
generated the world.

Maintain a persistent attribution surface appropriate to the medium and a
license/about page.

## 9. Provider contract

Future providers should expose project-owned semantics such as:

```text
GeoDataSource.load(bounds, featureProfile)
PlaceSearchProvider.search(query)
```

not provider-native APIs throughout the engine.

## 10. Failure behavior

Runtime provider failure must be isolated:

```text
network/provider failure
→ retry/backoff if appropriate
→ cached data if valid
→ user-visible unavailable area
```

Never corrupt existing active chunks because a neighbor request failed.

## Sources checked

- https://www.openstreetmap.org/copyright
- https://osmfoundation.org/wiki/Licence/Attribution_Guidelines
- https://operations.osmfoundation.org/policies/nominatim/
- https://operations.osmfoundation.org/policies/tiles/
- https://operations.osmfoundation.org/policies/vector/
- https://dev.overpass-api.de/overpass-doc/en/preface/commons.html
