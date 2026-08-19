# OpenGTA Web — V0 Test Strategy

## Test pyramid

### Pure unit tests

Use for:

- coordinate projector;
- unit parsing;
- ring winding/validation;
- OSM tag normalization;
- road width selection;
- visual-height fallback;
- vehicle math helpers;
- cache/version helpers when introduced.

### Fixture/component tests

Use original synthetic fixture for:

- canonical model;
- compiler;
- collisions;
- deterministic output.

Use committed Lecce fixture for:

- real OSM parsing;
- relation/multipolygon handling;
- full normalization/compiler integration.

### Browser smoke tests

After renderer exists:

- app boots;
- canvas created;
- fixture loads;
- no uncaught error;
- player vehicle exists;
- movement input changes player state;
- debug overlay can be shown.

### Visual checks

Do not begin with brittle full-pixel snapshots.

Prefer semantic/browser checks plus saved screenshots for human/debug evidence.

Later add targeted image comparisons only for stable deterministic visuals.

## Network rule

No V0 automated test may require public OSM/Overpass/Nominatim connectivity.

## Determinism

Structural compiler tests should compare normalized/compiled semantics after
sorting by stable feature ID, not incidental object insertion order.

## Error cases

Required tests:

- malformed height;
- missing referenced OSM node;
- open building way;
- relation member missing;
- duplicate points;
- polygon with hole;
- unknown highway;
- invalid finite coordinate;
- zero/very-short road segment.

## Type check

Testing does not replace TypeScript type-check.

Both must pass.

## Test reporting

Codex must report exactly what was run and must not claim browser/performance
coverage that the environment did not execute.
