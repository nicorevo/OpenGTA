# DATA-03: Tile coverage resolver

**Stato:** pianificato. **Dipendenze:** DATA-02. **Persona:** fullstack-developer. **Taglia:** S.

## Obiettivo
`tilesForRuntimeRegion(request, zoom)`: lista deterministica e completa di
tile z/x/y che coprono un bounds runtime (300 m), senza duplicati, con
clamp Web Mercator; test su confine tile.

## READ
`src/geo/mvt/` (DATA-02), `src/world/runtime/source.ts` (RuntimeRegionRequest).

## MAY MODIFY / DO NOT TOUCH
Modificabili: `src/geo/mvt/coverage.ts` + test. Non cambiare chunk grid.

## TDD
1. RED: copertura di un bounds attorno a Lecce a z14 (atteso 1-2 tile),
   bounds che attraversa un confine tile (atteso 2-4), lat oltre clamp.
2. Implementare; GREEN.

## Accettazione
- [ ] AC1: lista deterministica, completa, senza duplicati.
- [ ] AC2: test su confine tile e clamp Web Mercator.
- [ ] AC3: nessun NaN/Infinity; suite verde.

## Verifica
`npm run test:run -- src/geo/mvt` + gate comune.

## Handoff
DATA-04 usa il resolver per le richieste.
