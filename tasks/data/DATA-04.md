# DATA-04: Provider OpenFreeMap

**Stato:** pianificato. **Dipendenze:** DATA-03. **Persona:** fullstack-developer. **Taglia:** S.

## Obiettivo
`VectorTileProvider.getTile(key, signal)`: fetch bounded (budget byte,
abort), 404/204 = vuoto deterministico, errori http/network/timeout/abort
distinti, URL deterministico con dataset version esplicita
(`planet/20260830_080001_pt`, NON `latest`), nessuna API key, identity
esplicita `openfreemap:planet:20260830_080001_pt`.

## READ
`src/geo/mvt/`, `src/world/runtime/response-reader.ts` (pattern bounded),
TileJSON live (URL pinnato misurato).

## MAY MODIFY / DO NOT TOUCH
Modificabili: `src/world/runtime/vector-tile/provider.ts` + test. Non
toccare canonical/compiler/renderer/fisica.

## TDD
1. RED: fetch reale non nei test: mock Response con PBF fixture; abort a
   meta' lettura; 404 → miss deterministico; payload oltre budget →
   `response-too-large`.
2. Implementare; GREEN.

## Accettazione
- [ ] AC1: URL deterministico con versione dataset; AbortSignal propagato.
- [ ] AC2: byte limit; 404/204 vuoto deterministico; errori distinti.
- [ ] AC3: nessuna API key; identity esplicita; suite verde.

## Verifica
`npm run test:run -- src/world/runtime/vector-tile` + gate comune.

## Handoff
DATA-11 compone provider + mapping nel compiler sperimentale.
