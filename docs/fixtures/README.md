# V0 Fixtures

This folder contains fixture specifications and original synthetic data.

## Real-world fixture

`lecce-v0/`

- real geographic target;
- intended to be fetched once and committed as a deterministic fixture;
- OSM-derived data must remain clearly attributed/licensed;
- runtime V0 must not depend on a live API.

## Synthetic fixture

`synthetic/`

- original test geometry;
- no OSM data;
- useful for deterministic unit/compiler tests;
- intentionally small enough to understand by inspection.

## Rule

Do not use live network calls inside unit tests.
