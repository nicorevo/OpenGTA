# DATA-14: CanonicalRegionSource

**Stato:** pianificato. **Dipendenze:** DATA-13. **Persona:** fullstack-developer. **Taglia:** M.

## Obiettivo
`CanonicalRegionSource { identity, profile, acquire(request, options) →
WorldRegion }` con implementazioni `OverpassCanonicalRegionSource`
(normalizer OSM esistente) e `VectorTileCanonicalRegionSource` (normalizer
MVT). Il runtime compila via `compileRegion`; il seam `options.compile`
resta per compatibilita' (test/estensioni). Cache namespace da identity +
profile + normalizer/compiler version.

## READ
DATA-13, `src/world/runtime/open-world.ts`, ADR-011.

## MAY MODIFY / DO NOT TOUCH
Modificabili: runtime/source/sessione/bootstrap e test. Non cambiare
compileRegion/fisica/renderer/gameplay.

## TDD
1. RED: runtime con OverpassCanonicalRegionSource produce lo stesso chunk
  del percorso attuale (fixture); MVT source idem (DATA-13).
2. Implementare; GREEN; rimuovere il finto RawOsm dal percorso MVT.

## Accettazione
- [ ] AC1: entrambe le source dietro lo stesso contratto; un solo compiler.
- [ ] AC2: namespace isolato per identity/profile; nessun riuso errato.
- [ ] AC3: suite completa, E2E (Overpass e MVT) e smoke verdi.

## Verifica
`npm run test:run` + `npm run test:e2e` + smoke dist.

## Handoff
Chiude il refactor: DATA-15..18 (PMTiles/custom schema/packages) si
appoggiano al contratto senza toccare canonical/compiler.
