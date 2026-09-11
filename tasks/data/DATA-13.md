# DATA-13: Normalizer MVT canonico

**Stato:** pianificato. **Dipendenze:** DATA-12. **Persona:** fullstack-developer. **Taglia:** M.

## Obiettivo
`src/geo/normalize/mvt.ts`: `DecodedVectorTile → WorldRegion` (roads,
buildings, land, water; clip ai bounds; deduplica; ID deterministici).
Il compiler resta UNICO (`compileRegion`). Nessun fetch/cache/renderer/
physics dentro il normalizer.

## READ
DATA-06..08, DATA-12, `src/geo/normalize/osm.ts` (forma WorldRegion).

## MAY MODIFY / DO NOT TOUCH
Modificabili: `src/geo/normalize/mvt.ts` e test; DATA-11 compiler passa dal
normalizer. Non cambiare compileRegion/renderer/fisica.

## TDD
1. RED: tile fixture → WorldRegion con conteggi coerenti con DATA-09.
2. Implementare; GREEN; E2E DATA-11 restano verdi.

## Accettazione
- [ ] AC1: DecodedVectorTile → WorldRegion senza RawOsm finti.
- [ ] AC2: un solo compiler; nessuna logica provider nel canonical.
- [ ] AC3: suite verde; parity invariata.

## Verifica
`npm run test:run -- src/geo/normalize` + E2E MVT + gate comune.

## Handoff
DATA-14 generalizza il contratto di source.
