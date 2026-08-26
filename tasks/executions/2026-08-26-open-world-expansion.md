# Execution Log: Open World Expansion

**Data:** 2026-08-26
**Obiettivo:** completare il passaggio dalla fondazione runtime alla gestione
multi-chunk e al boundary HTTP live.

## Implementazione

- Aggiunta la partizione di `CompiledChunkV0` per bounds, con clipping di
  poligoni, hole, polilinee e collisioni.
- Conservata la feature identity sui frammenti e definito owner deterministico
  dall’anchor della feature.
- Aggiunta traslazione da local source space a world space.
- Il renderer PixiJS e il bootstrap accettano più chunk attivi; la fisica usa le
  collisioni della finestra attiva.
- Aggiunto `createHttpGeoDataSource` con bbox, status HTTP e abort già protetti
  dal boundary timeout/rate limit.

## Verifiche

- `npm run test:run`: PASS — 21 file, 81 test.
- `npm run test:e2e`: PASS — 2 test Chrome.
- `npm run typecheck`: PASS.
- `npm run build`: PASS; warning noto sul chunk PixiJS principale.

## Limiti residui

Il default resta offline e deterministico sul fixture Lecce. L’adapter HTTP è
disponibile ma non viene attivato automaticamente né vincolato a uno specifico
provider OSM; endpoint, policy di consenso e gestione credenziali restano
decisioni di prodotto separate.
