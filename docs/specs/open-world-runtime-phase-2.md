# Open World Runtime — Phase 2 Specification

**Status:** Proposed for implementation
**Date:** 2026-08-26
**Depends on:** `docs/architecture/dual-world-pipeline.md`,
`docs/architecture/chunk-streaming-cache.md`,
`docs/specs/compiled-chunk-v0-contract.md`

## Objective

Portare il runtime da una singola `WorldRegion` compilata in memoria a una
finestra locale di chunk compatibili, mantenendo un solo canonical world model,
un solo compiler e un solo runtime per le modalità Preprocessed e Open World.

Questa fase non introduce ancora acquisizione live, cache persistente o AI.
Costruisce il confine tecnico necessario per poterle aggiungere senza cambiare
le semantiche del mondo.

## Ordered Slices

### P2.1 — Chunk identity and deterministic grid

- definire dimensione configurabile e identità stabile della cella;
- convertire una posizione locale in `ChunkKey` senza ambiguità sui bordi;
- produrre bounds adiacenti in ordine deterministico;
- non modificare feature identity né introdurre rete.

Acceptance: test deterministici per origine, coordinate negative, bordi e
adiacenze; nessuna dipendenza da PixiJS, Rapier o browser.

### P2.2 — Chunk lifecycle in memory

- modellare `ABSENT`, `REQUESTED`, `COMPILING`, `READY`, `ACTIVE`, `INACTIVE`;
- accettare un loader iniettato e ignorare risultati obsoleti;
- rendere esplicite transizioni e failure senza corrompere chunk attivi.

Acceptance: test di transizioni, deduplicazione richieste, stale result e
fallimento del loader.

### P2.3 — Active window and local seams

- calcolare la finestra in base a posizione, velocità e camera;
- attivare il minimo mondo giocabile prima dei vicini;
- testare continuità e ownership delle feature ai confini.

Acceptance: finestra deterministica, priorità P0/P1/P2 e fixture multi-chunk con
seam verificabili.

### P2.4 — In-memory warm cache

- riutilizzare chunk compilati durante la sessione;
- applicare eviction esplicita e bounded memory;
- mantenere la versione del compiler nell’identità del contenuto.

Acceptance: hit/miss/eviction testati e nessuna risorsa renderer/physics nella
cache canonica.

### P2.5 — Runtime acquisition boundary

- introdurre `GeoDataSource` con coordinate arbitrarie;
- normalizzare e compilare tramite gli stessi contratti del V0;
- isolare timeout, rate limit e dati non attendibili al boundary.

Acceptance: fake source deterministico, error path e primo chunk giocabile senza
attendere l’intera area.

### P2.6 — Open World Runtime mode

- collegare acquisizione, lifecycle, active window e cache;
- avviare il gameplay sul primo chunk pronto;
- preparare progressivamente i vicini e degradare senza AI.

Acceptance: smoke E2E su coordinate selezionabili, caricamento progressivo,
riuso cache e assenza di dipendenza da un fixture hard-coded.

## Non-goals della Phase 2

- dimensione definitiva dei chunk;
- IndexedDB o altra tecnologia di persistenza;
- servizio OSM pubblico obbligatorio;
- multiplayer, AI strutturale o traffico;
- cambio di renderer o physics engine.

## Invariants

- La feature identity è indipendente dal chunk che la visualizza.
- I risultati obsoleti non possono sostituire uno stato più recente.
- Un errore di acquisizione non rimuove chunk attivi validi.
- Il runtime consuma `CompiledChunkV0` senza conoscere l’origine del dato.
- La prima interazione non attende la compilazione dell’intera città.
