# Execution Log: P2.5 Runtime Source Boundary

**Data:** 2026-08-26
**Obiettivo:** introdurre l’acquisizione runtime con boundary sicuro e pipeline
  normalize/compile condivisa.

## Implementazione

- Aggiunto `src/world/runtime/source.ts` con `GeoDataSource` e request basata
  su coordinate arbitrarie, raggio e region ID.
- Aggiunti validazione dei parametri, limite dimensionale, timeout con abort e
  intervallo minimo tra acquisizioni.
- Validata la forma del payload OSM prima di passarlo alla normalizzazione.
- Aggiunta `compileRuntimeRegion`, che usa lo stesso proiettore, normalizer e
  compiler del V0.

## Verifiche

- `npm run test:run -- src/world/runtime/source.test.ts`: PASS — 5 test.
- `npm run typecheck`: PASS.
- `npm run test:run`: PASS — 19 file, 73 test.
- `npm run build`: PASS; warning noto sul chunk PixiJS principale.

## Scope escluso

La sorgente è un boundary iniettato e non effettua richieste pubbliche. La
selezione dei chunk, il lifecycle, la cache e l’integrazione UI seguono le
slice successive.
