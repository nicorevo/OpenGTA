# Esecuzione dei task City Drive Stable

Data: 2026-09-11. Stato: contratti pianificati, non ancora implementati.
Indice operativo: [piano](../plan.md), [checklist](../todo.md).
Spec: [`docs/specs/city-drive-stable.md`](../../docs/specs/city-drive-stable.md).
ADR: [`docs/adr/ADR-010-discrete-zoom-lod.md`](../../docs/adr/ADR-010-discrete-zoom-lod.md).
Design: [`docs/architecture/zoom-and-lod.md`](../../docs/architecture/zoom-and-lod.md).

## Avvio per un modello senza contesto

Prompt di assegnazione riutilizzabile:

```text
Esegui il task CITY-NN (SOLID/ZOOM/LOD/CACHE) in tasks/city/<ID>.md.
Leggi prima AGENTS.md e tasks/city/README.md, poi solo le letture richieste
dalla scheda. Verifica le dipendenze nel codice e nei log. Implementa con TDD
entro il perimetro indicato, esegui le verifiche e aggiorna piano, checklist
e log. Non implementare gli altri task.
```

## Letture comuni obbligatorie

- `AGENTS.md`, `CODING-STANDARDS.md`, `SECURITY.md`.
- `docs/SPEC.md`, `docs/handoff/CURRENT.md`, `docs/codex/architecture-guardrails.md`.
- Spec e ADR citati sopra; `docs/architecture/2d-rendering-model.md` §26-27.
- `.opencode/references/definition-of-done.md`.
- Log della tranche ONLINE in `tasks/executions/` (solo i prerequisiti citati).

## Regole di esecuzione e consegna

Come nella tranche precedente (`tasks/online/README.md`): un task alla volta,
TDD con rosso osservato, gate comune (`npm run typecheck`, `npm run test:run`,
`npm run test:e2e`, `npm run build`, smoke dist con `OPENGTA_E2E_PREVIEW=1`),
log in `tasks/executions/YYYY-MM-DD-<ID>.md` col [template](../online/EXECUTION-TEMPLATE.md),
checkbox aggiornate solo con evidenza, commit atomici senza push/deploy.
Gli E2E restano offline e deterministici (catch-all di rete su ogni spec).

## Contratti condivisi

### C-CAMERA: stato camera e zoom (ZOOM-01..05)

- Modulo puro `src/app/camera.ts` senza dipendenze Pixi/Rapier/DOM:
  `ZoomLevel = 0..4`, `ZOOM_STEPS` (valori sperimentali), `clampZoom`,
  `zoomFactor`, `lodForZoom`, `cameraBounds(position, screenSize, scale)`.
- `viewScale = baseScale * zoomFactor(level)` con `baseScale` invariata;
  `cameraBounds()` del renderer deriva da `viewScale`. Centro camera = posizione
  veicolo a ogni zoom.
- Lo zoom NON tocca fisica, fixed-step, spawn o guardia di disponibilita'.
  La guardia continua a usare i chunk APPLICATI, non quelli visibili.
- Cambi rapidi di zoom: la domanda di streaming passa dal debounce esistente
  (200 ms) e dalla firma di domanda; nessuna nuova tempesta di richieste.

### C-RENDER: renderer incrementale (SOLID-04, LOD-01..05)

- `setChunk(chunk)`, `updateChunk(chunk)`, `removeChunk(chunkId)` con
  presentazione per chunk raggruppata in container per tipo di layer
  (ground < roads < buildings < labels): ordine globale e mask preservati.
- Chunk invariato = zero rebuild, zero allocazione. `render(list)` resta come
  compatibilita' V0 e rebuild completo esplicito.
- LOD solo in presentazione: profilo per tier (facade, road detail, labels,
  soglia culling px²) centralizzato, mai nel canonical world.
- `dispose` idempotente libera tutte le presentazioni.

### C-CACHE: storage persistente (CACHE-01..04)

- Interfaccia astratta `PersistentChunkStore` con `get/put/delete/clear/quota`
  e gestione esplicita degli errori; implementazione in-memory per i test.
- Chiave = namespace della warm cache esistente + compiler/schema version:
  entry incompatibile o corrotta = discard, mai uso silenzioso.
- Budget ed eviction dichiarati; la sessione funziona anche con storage
  assente o quota piena. Nessun segreto nel client.

### C-CANARY: verifica live (CITY-01)

- Suite `tests/canary/` separata dalla CI, avvio manuale/nightly, mai
  bloccante per i test deterministici. Report con data/endpoint/esito
  separati. Richieste limitate, nessuna rotazione di mirror per aggirare
  rifiuti. Citta' di riferimento: Lecce per prima, lista estesa dopo.
