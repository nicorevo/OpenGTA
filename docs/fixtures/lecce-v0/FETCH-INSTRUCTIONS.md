# Fetching the Lecce V0 Fixture

The repository should contain the downloaded response so tests and V0 do not
depend on a live Overpass service.

## Input

`lecce-v0.overpassql`

## Output target

Recommended repository path after application scaffold:

```text
src/fixtures/geo/lecce-sant-oronzo-v0.raw.json
```

or the equivalent path required by repository standards.

## Fetch rule

This fetch is a one-time developer operation.

Do not fetch the fixture every test run or every application start.

## Provenance file

Alongside the raw data, record:

```text
source endpoint
fetch timestamp
query filename/hash
OSM attribution
ODbL notice
```

## Public service caution

Public Overpass instances are shared community infrastructure.

Use one request at a time, keep the query bounded, cache the result and do not
build production runtime assumptions around a public endpoint.

## V0 runtime rule

Once committed, V0 loads the local fixture only.
