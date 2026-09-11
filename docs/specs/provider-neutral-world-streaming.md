# Spec: OpenGTA Provider-Neutral World Streaming

**Stato:** pianificata (tranche DATA, `tasks/plan.md`).
**Baseline:** `4e42d82` (City Drive Stable).
**Fonte:** `OPENGTA-DATA-SOURCE-MIGRATION.md` (documento di migrazione,
copiato in `docs/OpenGTA-DATA-SOURCE-MIGRATION.md` come riferimento).
**ADR:** ADR-011.

## Obiettivo

Eliminare la dipendenza strutturale da Overpass come hot path dello
streaming: il giocatore guida su chunk compilati che possono arrivare da
Overpass, da Vector Tiles (MVT/OpenMapTiles), da PMTiles o dalla cache
persistente, senza che renderer, fisica, spawn, guardia o chunk grid
cambino. Overpass resta come reference/debug/fallback di sviluppo.

Vincolo del PoC (misurato in questo ambiente): la public instance di
OpenFreeMap serve fino a z14; z15/z16 risultano vuoti. Il PoC usa quindi
z14 e la parity DATA-09 decide GO / GO VISUAL ONLY / NO-GO GAMEPLAY con
evidenza; per il NEAR gameplay ad alta risoluzione il documento prevede
custom OpenGTA tiles o PMTiles regionali (fasi successive).

## Requisiti funzionali

- F-SRC-1: tre classi di sorgente (Overpass, MVT XYZ, PMTiles futuro)
  dietro una pipeline provider-neutral: tutte producono `WorldRegion` →
  `compileRegion` → `CompiledChunkV0`.
- F-SRC-2: il PoC MVT usa il seam `options.compile` del runtime e NON
  costruisce RawOsm finti: MVT → decode → modello decodificato →
  normalizer MVT → WorldRegion → compiler unico.
- F-SRC-3: Overpass non e' piu' necessario per il core runtime; resta
  selezionabile come provider legacy/debug.
- F-SRC-4: feature flag `provider=openfreemap-mvt` con consenso
  provider-neutral; il default resta Overpass finche' i gate G1-G8 del
  documento non sono superati.
- F-SRC-5: identity della cache include provider/dataset/schema/MVT zoom/
  versione normalizer; nessun riuso fra sorgenti incompatibili.
- F-SRC-6: deduplicazione delle fetch: una tile = una richiesta in-flight,
  molti consumatori; abort condiviso solo quando non restano consumatori
  (PoC: tile fetch breve, abort al count 0).

## Requisiti non funzionali

- N-SRC-1: input non attendibile: limiti su tile bytes, feature per tile,
  punti per feature, proprieta'; errori `invalid-tile`/`response-too-large`
  con sessione degradata, mai crash.
- N-SRC-2: retry MVT: network/5xx con backoff breve, 429 con Retry-After,
  404/204 = vuoto deterministico, abort = nessun retry.
- N-SRC-3: zoom MVT ≠ zoom camera: source gameplay a risoluzione fissa
  (z14 nel PoC); la camera cambia solo presentazione.
- N-SRC-4: seam tile: clip ai bounds autorevoli OpenGTA, deduplica, ID
  deterministici; niente gap, collisioni doppie o facade doppie ai confini.
- N-SRC-5: attribuzione OSM sempre visibile; per OpenFreeMap seguire le
  richieste di attribuzione del provider.
- N-SRC-6: la cache persistente dei chunk compilati (gia' consegnata)
  resta il fallback piu' potente in caso di rete assente.

## Definition of Done (dal documento, sezione 91)

Overpass non necessario; una source MVT produce chunk giocabili; renderer e
fisica senza branch provider-specifici; identity cache corretta; richieste
bounded/cancellabili/deduplicate; seam testati; geometria invalida non
crasha; 100+ transizioni stabili; rete assente degrada senza distruggere la
sessione; zoom non altera la fisica; cache compilata evita ricompilazioni;
attribuzione corretta; PMTiles aggiungibile senza toccare
canonical/compiler.
