# Piano: Taxi giallo GTA 1

Data: 2026-09-20. Obiettivo: usare l'immagine allegata dall'utente come
sprite del taxi, con proporzioni originali, muso orientato nella direzione
di guida e texture inclusa nel bundle per funzionare offline.

- [x] TAXI-01: integrare lo sprite locale mantenendo ombra, zoom e derapata;
      verificare proporzioni e orientamento con test unitari.
- [x] TAXI-02: eseguire suite, typecheck, build e verifica browser della guida;
      registrare provenienza dell'asset e risultato.

Esito: 438 test unitari verdi (`npm run test:run -- --maxWorkers=2`),
typecheck e build verdi, 4 E2E bootstrap/zoom verdi. Il test della rotta lunga
ha superato 5 s durante la prima esecuzione concorrente con build/browser;
passa isolato e nella suite con due worker. Nessuno script lint disponibile.
Verifica visiva in Chrome a zoom massimo: sprite originale, nessun errore JS.
Provenienza: `src/render/pixi/assets/taxi.PROVENANCE.md`.

---

# Piano: GTA 2D — citta' dall'alto (strade e palazzi)

Data: 2026-09-20 (aggiornato 2026-09-21). Stato: G2D-00..01 consegnati
(commits `758255a` + `df5be7b`, docs `723deb7`), G2D-02..18 da fare.
Baseline codice: `758255a`. Analisi:
`docs/analysis/GTA-2D-VISUAL-GAP-2026-09-20.md`; spec:
`docs/specs/gta-2d-city-v1.md`; ADR proposta:
`docs/adr/ADR-013-gta-top-down-presentation.md`. Istruzioni e schede:
[gta-2d/README.md](gta-2d/README.md).

## Obiettivo

Guidare il taxi in una citta' dall'alto con proporzioni, materiali stradali,
marciapiedi e facciate paragonabili allo screenshot fornito: prima un
incrocio giocabile e due isolati (finestre, tetti, ombre), poi l'applicazione
alle geometrie reali offline e MVT. Collisioni e sagome geografiche restano
2D; la vista prima persona esistente continua a consumare gli stessi chunk.

## Come usare il piano

1. Leggere [istruzioni e contratti comuni](gta-2d/README.md).
2. Un task alla volta: scheda, dipendenze, TDD, gate comune, log.
3. Aggiornare la riga qui e in [todo](todo.md) solo con evidenza.

## Task ordinati

| Stato | ID e scheda | Dipendenze | Taglia | Esito verificabile |
| --- | --- | --- | --- | --- |
| [x] | [G2D-00 Quartiere di riferimento](gta-2d/G2D-00.md) | Nessuna | M | Fixture X/T/Y/curva/vicolo + 7 palazzi, boot offline nell'harness, baseline a 3 viewport con GPU/distinzione software (`GTA-2D-BASELINE.md`) |
| [x] | [G2D-01 Proporzioni taxi, strada e camera](gta-2d/G2D-01.md) | G2D-00 | M | Taxi 37x17 px a 640x480; strada 6 m = 48 px >= 2 larghezze; preset guida 6.0, zoom max separato; fix culling a far |
| [ ] | [G2D-02 Prova della profondita' prospettica](gta-2d/G2D-02.md) | G2D-01 | M | GO/NO-GO su pareti base-tetto, camera 4 quadranti, risultato `GTA-2D-PROJECTION-RESULT.md` |
| [ ] | [G2D-03 Asfalto con materiale continuo](gta-2d/G2D-03.md) | G2D-02 | M | Atlas con 2 asfalti, UV metriche, fallback colore, provenienza |
| [ ] | [G2D-04 Marciapiedi pavimentati e cordoli](gta-2d/G2D-04.md) | G2D-03 | M | Fascia pavimentata esterna alla carreggiata, cordolo, riduzione nei vicoli |
| [ ] | [G2D-05 Incroci raccordati X, T e Y](gta-2d/G2D-05.md) | G2D-04 | M | Centro unico senza cordoli/marciapiedi; livelli incompatibili dichiarati ambigui |
| [ ] | [G2D-06 Segnaletica coerente con l'incrocio](gta-2d/G2D-06.md) | G2D-05 | M | Preset giallo/bianco, fase metrica, niente mezzeria nei vicoli |
| [ ] | [G2D-07 Contratto dei metadati visivi e cache](gta-2d/G2D-07.md) | G2D-02 | M | Contratti opzionali validati; payload V0 compatibile; corrotti = cache miss |
| [ ] | [G2D-08 Provenienza dei contorni dalle tile](gta-2d/G2D-08.md) | G2D-07 | M | Bordi veri vs tagli del normalizzatore; partial esplicito |
| [ ] | [G2D-09 Metadati continui dopo compilazione e partizione](gta-2d/G2D-09.md) | G2D-08 | M | Bordi/distanze propagati nel clipping; compilerVersion bump |
| [ ] | [G2D-10 Facciate modulari nel renderer di gioco](gta-2d/G2D-10.md) | G2D-02, G2D-03, G2D-09 | M | 4 famiglie di facciata con finestre; nessuna parete sui tagli |
| [ ] | [G2D-11 Tetti, cornici e dettagli degli edifici](gta-2d/G2D-11.md) | G2D-10 | M | 3 tetti, cornice continua, dettagli deterministici |
| [ ] | [G2D-12 Ombre e visibilita' del taxi](gta-2d/G2D-12.md) | G2D-11, G2D-06 | M | Ombre coerenti; policy di occlusione del taxi; via la corridor mask |
| [ ] | [G2D-13 Continuita' grafica tra chunk](gta-2d/G2D-13.md) | G2D-09, G2D-12 | M | UV/seed/fase stabili tra arrivi invertiti e reload |
| [ ] | [G2D-14 LOD e culling della profondita'](gta-2d/G2D-14.md) | G2D-13 | M | Culling sui bounds proiettati; tier senza salti |
| [ ] | [G2D-15 Arredo urbano decorativo essenziale](gta-2d/G2D-15.md) | G2D-14 | M | Tombini/cestini/lampioni deterministici, rinviabile |
| [ ] | [G2D-16 Verifica sulla citta' reale e sulle tile MVT](gta-2d/G2D-16.md) | G2D-14 | M | Replay deterministico 2 tile + 4 chunk + fixture Lecce |
| [ ] | [G2D-17 Budget di rendering e lifecycle](gta-2d/G2D-17.md) | G2D-16, G2D-15 | M | p95 <= 16.7 ms desktop / 33.3 ms mobile su GPU dichiarata |
| [ ] | [G2D-18 Confronto finale e consegna](gta-2d/G2D-18.md) | G2D-17 | M | Scorecard pass/fail sui gate A-E, handoff |

## Checkpoint

| Gate | Task | Risultato |
| --- | --- | --- |
| A proporzioni/proiezione | 00-02 | GO/NO-GO della proiezione |
| B incrocio completo | 03-06 | asfalto, pavimentazione, cordoli, strisce |
| Dati | 07-09 | identita', bordi e cache prima delle facciate live |
| C quartiere | 10-12 | facciate, tetti, ombre, taxi leggibile |
| D continuita' | 13-16 | LOD, citta' reale; 15 separabile |
| E consegna | 17-18 | misure, regressioni, scorecard |

Verifiche intermedie dopo 03-04, 07-08 e 13-14. Il filone 07-09 puo'
procedere indipendentemente da 03-06 dopo il PoC; niente modifiche
concorrenti sugli stessi file. Il piano non avvia agenti.

## Rischi e scelte esplicite

| Rischio | Gestione prevista |
| --- | --- |
| Proiezione/ordinamento Pixi non reggono | GO/NO-GO in G2D-02; fallback piatto documentato; ADR resta Proposed |
| Contorni tagliati dal clipping | Provenienza dei bordi prima del taglio (G2D-08/09); partial esplicito |
| Maschera stradale taglia le facciate | Sostituita in G2D-12 con policy di occlusione esplicita |
| Nessun target FPS gia' misurato | Misure solo su GPU/dispositivo dichiarati (G2D-17); headless separato |

# Piano: Provider-Neutral World Streaming (tranche DATA)

Data: 2026-09-11. Analisi di riferimento:
`docs/OpenGTA-DATA-SOURCE-MIGRATION.md` (migrazione Overpass → MVT/PMTiles).
Stato: completato (DATA-00..14); DATA-15..18 da dettagliare.
Baseline codice: `4e42d82`. Responsabile della pianificazione: tech-lead-planner.

## Obiettivo

Eliminare Overpass come dipendenza strutturale dello streaming: chunk
giocabili da Vector Tiles (OpenFreeMap/OpenMapTiles z14, massimo della
public instance) attraverso la stessa pipeline canonical/compiler/renderer/
fisica, con Overpass conservato come reference/debug/fallback e la parity
Lecce a decidere GO/GO-VISUAL/NO-GO. Spec:
`docs/specs/provider-neutral-world-streaming.md`, ADR-011.

Vincolo misurato in questo ambiente: overpass-api.de irraggiungibile
(connection refused), osm.ch serve dataset vuoto, mail.ru raggiungibile,
tiles.openfreemap.org raggiungibile con z14 pieno e z15+ vuoti.

## Come usare il piano

1. Leggere [istruzioni e contratti comuni](data/README.md).
2. Un task alla volta: scheda, dipendenze, TDD, gate comune, log.
3. Aggiornare la riga qui e in [todo](todo.md) solo con evidenza.

## Confini

Inclusi: diagnostica failure, fallback Overpass di sviluppo, tile math,
decoder MVT bounded, coverage resolver, provider OpenFreeMap, modello
decodificato, mapping transportation/building/land/water, parity Lecce,
benchmark, runtime dietro feature flag, seam tests, normalizer MVT
canonical, refactor CanonicalRegionSource.

Differiti (righe senza scheda, da dettagliare prima dell'esecuzione):
DATA-15 PMTiles locale, DATA-16 custom tile schema (ADR), DATA-17 cache
compilata persistente (GIA' consegnata in CACHE-01..04: solo verifica di
riuso), DATA-18 curated region package.

## Task ordinati

| Stato | ID e scheda | Dipendenze | Taglia | Esito verificabile |
| --- | --- | --- | --- | --- |
| [x] | [DATA-00 Diagnostica failure](data/DATA-00.md) | Nessuna | S | Categoria/host/tentativi/durata visibili senza payload nei log |
| [x] | [DATA-01 Fallback Overpass](data/DATA-01.md) | DATA-00 | S | Network/5xx persistente passa al secondario; 429 rispettato |
| [x] | [DATA-02 Tile math e decoder MVT](data/DATA-02.md) | Nessuna | M | lat/lon→z/x/y deterministico; tile fixture decodificata; malformed non crasha |
| [x] | [DATA-03 Coverage resolver](data/DATA-03.md) | DATA-02 | S | Lista tile deterministica, completa, senza duplicati, clamp Mercator |
| [x] | [DATA-04 Provider OpenFreeMap](data/DATA-04.md) | DATA-03 | S | Fetch bounded e cancellabile; 404/204 vuoto; errori distinti |
| [x] | [DATA-05 Modello decodificato](data/DATA-05.md) | DATA-02 | S | DecodedVectorFeature tipizzato, nessun oggetto decoder nel canonical |
| [x] | [DATA-06 Mapping transportation](data/DATA-06.md) | DATA-05 | M | Classi OMT→OpenGTA con warning per classi ignote |
| [x] | [DATA-07 Mapping building](data/DATA-07.md) | DATA-05 | S | render_height/fallback deterministico |
| [x] | [DATA-08 Mapping land/water](data/DATA-08.md) | DATA-05 | S | park/landuse/landcover/water/waterway → LandArea/Water |
| [x] | [DATA-09 Parity Lecce](data/DATA-09.md) | DATA-06..08 | M | Conteggi e decisione GO/GO-VISUAL/NO-GO documentata |
| [x] | [DATA-10 Benchmark Overpass vs MVT](data/DATA-10.md) | DATA-09 | M | Metriche con ambiente dichiarato |
| [x] | [DATA-11 Runtime feature flag](data/DATA-11.md) | DATA-09 | L | provider=openfreemap-mvt guida 10+ chunk con stesso runtime |
| [x] | [DATA-12 Seam tests](data/DATA-12.md) | DATA-11 | M | Tile sintetiche: no gap/duplicati/doppie facade, output deterministico |
| [x] | [DATA-13 Normalizer MVT canonico](data/DATA-13.md) | DATA-12 | M | DecodedVectorTile→WorldRegion; compiler unico |
| [x] | [DATA-14 CanonicalRegionSource](data/DATA-14.md) | DATA-13 | M | Runtime consuma WorldRegion; Overpass e MVT dietro lo stesso contratto |
| [ ] | DATA-15 PMTiles PoC locale | DATA-14 | M | Scheda da dettagliare prima dell'esecuzione |
| [ ] | DATA-16 Custom tile schema ADR | DATA-09 | S | Scheda da dettagliare prima dell'esecuzione |
| [ ] | DATA-17 Persistent compiled cache (verifica riuso) | CACHE-04 | S | Gia' consegnata: verifica di riuso con la source MVT |
| [ ] | DATA-18 Curated region package | DATA-15..17 | L | Scheda da dettagliare prima dell'esecuzione |

## Checkpoint

### D-A: fondazioni, dopo DATA-00..05

- [x] Failure diagnosticabili senza indovinare; fallback dev rispettoso.
- [x] Tile math e decoder bounded con fixture reale; provider cancellabile.
- [x] Suite completa, typecheck, build, E2E verdi.

### D-B: mapping e parity, dopo DATA-06..10

- [x] Mapping OMT→OpenGTA coperto con warning; parity Lecce misurata.
- [x] Decisione GO/GO-VISUAL/NO-GO documentata con numeri.
- [x] Benchmark con ambiente dichiarato.

### D-C: runtime e seam, dopo DATA-11..14

- [x] MVT dietro feature flag guida 10+ chunk con lo stesso runtime.
- [x] Seam senza gap/duplicati; normalizer canonico; contratto unico.
- [x] Suite completa, typecheck, build, E2E verdi.

## Rischi e scelte esplicite

| Rischio | Gestione prevista |
| --- | --- |
| Public OFM ferma a z14 | PoC a z14; parity decide; custom tiles/PMTiles per il NEAR |
| Provider pubblico senza SLA | Mai default finche' G1-G8 del documento non passano |
| Tile vuote a zoom alti | 404/204 = vuoto deterministico, non errore |
| Seam/duplicati ai buffer | Clip ai bounds OpenGTA + deduplica + ID deterministici |
| Payload ostile | Limiti bytes/feature/punti; errori tipizzati |

## Storico preservato

Piano e checklist City Drive Stable: [archivio piano](archive/2026-09-11-plan.md)
e [archivio checklist](archive/2026-09-11-todo.md). La tranche ONLINE resta in
[archivio](archive/2026-09-10-plan.md). I log in `tasks/executions/` sono
evidenza storica.

---

## Piano: First-Person Perspective Renderer (OutRun-Style)

**Spec:** `docs/specs/first-person-renderer-v0.md`  
**Data:** 2026-09-14  
**Baseline codice:** post-fix label colors, `git log --oneline -10` prima del nuovo codice.

### Obiettivo

Aggiungere un renderer in prima persona (vista dal parabrezza) che permetta
di guidare in prospettiva OutRun, toggleabile con il renderer top-down esistente
tramite il tasto `V`.

### Architettura

```
Decisione: estendere PixiJS con un renderer alternativo nello stesso stage
- Stesso canvas, stessa interfaccia PixiRenderer
- Il renderer top-down resta intatto, non viene modificato
- Il primo-person usa solo i chunk attivi (stesso world data)
- Toggle istantaneo: V cambia quale renderer disegna
```

### Dependency Graph

```
road-projector.ts      (proiezione 3D→2D centerline)
    │
    ▼
segment-drawer.ts      (disegna poligoni strada back-to-front)
    │
    ▼
building-projector.ts  (proiezione edifici laterali)
    │
    ▼
sky-drawer.ts          (gradient orizzonte)
    │
    ▼
first-person-renderer  (orchestra i componenti)
    │
    ├─────────► presentation.ts  (toggle mode)
    └─────────► bootstrap.ts     (key handler V)
```

### Task List

### Phase 1: Core Projection (Tasks FP-01..03)

- [x] [FP-01](first-person/FP-01.md): camera 3D config (FOV, height, projection matrix)
- [x] [FP-02](first-person/FP-02.md): road segment projector (centerline → screen segments)
- [x] [FP-03](first-person/FP-03.md): road segment drawer (back-to-front poligoni)

### Checkpoint 1: Strada visuale
- [x] `npm run typecheck` verde
- [x] `npm run test:run` verde
- [x] Road retta visibile in prospettiva, larghezza corretta

### Phase 2: Buildings + Sky (Tasks FP-04..05)

- [x] [FP-04](first-person/FP-04.md): building side projection (edifici laterali)
- [x] [FP-05](first-person/FP-05.md): sky gradient (orizzonte)

### Checkpoint 2: Scena completa
- [x] Road + edifici + cielo visibili
- [x] Costruzione con `V` → top-down, `V` → first-person
- [x] Nessun test rotto

### Phase 3: Integration (Tasks FP-06..07)

- [x] [FP-06](first-person/FP-06.md): first-person renderer orchestration
- [x] [FP-07](first-person/FP-07.md): V key toggle (interfaccia PixiRenderer)

### Phase 3.5: Fix vista FPV (regressione)

**Nota 2026-09-16 (risolta):** la vista era rotta (camera ruotata di 90°
rispetto all'heading, ground strip a `ROAD_FILL` sulla strada, centerline MVT
troppo sparse, clamp asimmetrico). Diagnosi e fette di fix in
[FP-08](first-person/FP-08.md). Rework finale del modello di proiezione
completato (MVP): strade come **poligoni di piano terreno** in prospettiva
vera (`projectRoadPolygon`), edifici come **box 3D** (`projectBuildings`),
orizzonte a metà schermo con NDC reale, densificazione centerline e clamp
simmetrico. Guard permanente: `tests/e2e/first-person-view.spec.ts`.

- [x] [FP-08](first-person/FP-08.md): fix orientamento camera + layering ground/road + facciate edifici

### Checkpoint 3: End-to-end
- [x] Guida completa in first-person (guard e2e `first-person-view`)
- [x] Toggle V durante guida senza crash
- [x] 60 FPS stabile per 30 secondi (target; guard e2e + suite verde)

### Rischi e mitigazioni

| Rischio | Impatto | Mitigazione |
|---------|---------|-------------|
| Proiezione prospettica produce artefatti | Basso | Clamp Z depth, early-out su segmenti dietro camera |
| Edifici proiettati troppo grandi | Basso | Culling laterale ±30m, max height scale |
| Performance sotto i 60fps | Alto | Disabilitare edifici se draw calls > 120 |

---

## Piano: Code Review Remediation (RV)

Data: 2026-09-17. Analisi di riferimento: review complessiva del codice
condotta il 2026-09-17 (0 critici, 5 da risolvere prima del merge, 6
opzionali, 6 nit). Baseline codice: `ae92e10`. Baseline verificata: typecheck
verde, 355/355 test su 48 file. Responsabile esecuzione: fullstack-developer
(TDD).

### Obiettivo

Chiudere tutti i punti aperti della review: percorso MVT (cancellazione
stream sul budget, cache tile con dedup in-flight, concorrenza bounded, retry
che onora `Retry-After`), percorso caldo del renderer top-down (churn label
O(N²) + Text abbandonati), re-sync documentale (SECURITY.md vs codice) e
affidabilità del gate (test bench esclusi). Poi robustness (codec persistente,
relazioni OSM, IndexedDB), prima persona (app inattiva, pre-cull strade) e
pulizia (dead code, nits).

### Come usare il piano

1. Leggere [contratti e procedura comuni](review/README.md).
2. Un task alla volta: scheda, dipendenze, TDD, gate comune, log.
3. Aggiornare la riga qui e in [todo](todo.md) solo con evidenza.

### Task ordinati

Ordine = priorità + vincoli tecnici: RV-01 sblocca RV-04 (stesso file);
RV-03 rinforza il gate prima dei task P0 rimanenti; RV-02 è documentale e
indipendente; RV-11 dopo gli altri task (verifica assenza di riferimenti).

| Stato | ID e scheda | Dipendenze | Taglia | Esito verificabile |
| --- | --- | --- | --- | --- |
| [x] | [RV-01 Cancel stream MVT sul budget](review/RV-01.md) | Nessuna | S | Overrun budget → `reader.cancel()`; nessun stream aperto |
| [x] | [RV-03 Test bench nel gate](review/RV-03.md) | Nessuna | S | `npm run test:run` copre `tests/bench/*`; nessun side effect nel report |
| [x] | [RV-02 Re-sync SECURITY.md](review/RV-02.md) | Nessuna | S | Documentazione descrive IndexedDB, fallback DEV, budget effettivi; gate documentale |
| [x] | [RV-05 Label O(1) + destroy](review/RV-05.md) | Nessuna | M | Rebuild label senza O(N²); zero Text abbandonati; skip se nascoste |
| [x] | [RV-04 Cache tile + concorrenza + retry](review/RV-04.md) | RV-01 | L | Tile fetchato una sola volta (dedup in-flight); LRU bounded; retry 429/5xx con Retry-After e abort |
| [x] | [RV-10 Validazione codec deser](review/RV-10.md) | Nessuna | S | Record corrotti (NaN/null) scartati alla deser come miss |
| [x] | [RV-09 Pre-filtro bbox relazioni OSM](review/RV-09.md) | Nessuna | S | Point-in-ring solo dopo bbox reject; nessun regresso fixture |
| [x] | [RV-08 Write IndexedDB serializzate](review/RV-08.md) | Nessuna | M | Niente reconcile/evict concorrenti; invariant budget dopo ogni write |
| [x] | [RV-06 Stop app Pixi inattiva](review/RV-06.md) | Nessuna | S | L'app della vista nascosta non ha render loop attivo |
| [x] | [RV-07 Pre-cull strade FP](review/RV-07.md) | Nessuna | M | Nessuna densificazione per segmenti fuori frusta |
| [x] | [RV-11 Rimozione dead code](review/RV-11.md) | RV-05..07 | S | sky-drawer, projectPerspective, variabile mai letta rimossi; retry.test conservato (copertura live, premessa scheda errata) |
| [x] | [RV-12 Batch nits](review/RV-12.md) | RV-11 | S | Ring buffer metrics; Retry-After HTTP-date; superficie per frammento; riga lunga |

### Checkpoint

### R-A: P0, dopo RV-01, RV-03, RV-02, RV-05, RV-04

- [x] Percorso MVT: cancellazione, cache, concorrenza, retry — SECURITY.md
  §richieste al provider onorato da entrambi i provider.
- [x] Percorso caldo label O(1), nessun leak di Text.
- [x] Documentazione allineata al codice; gate include i test di regressione
  DoS e di parità.
- [x] Suite completa, typecheck, build, E2E verdi.

### R-B: robustness e performance, dopo RV-10, RV-09, RV-08, RV-06, RV-07

- [x] Suite completa, typecheck, build, E2E verdi.

### R-C: pulizia, dopo RV-11, RV-12

- [x] Nessun dead code; gate finale verde.

### Rischi e scelte esplicite

| Rischio | Gestione prevista |
| --- | --- |
| Cache tile con abort condiviso | La promessa in-flight non viene rejectata da un abort del singolo caller: il caller riceve l'errore di abort, il fetch prosegue per gli altri |
| Retry su 429 | Massimo un retry per fetch, delay clamped (min(Retry-After, 30 s)), abort-aware; nessun retry su rete transitoria (il path Overpass ha già il backoff in scheduler) |
| Evizione LRU di tile in uso | L'eviction riguarda solo fetch futuri: l'chunk attivo è già compilato |
| `app.stop()` al toggle | Al restart è garantito un render pass immediato prima del loop rAF |
| Rimozione dead code | Solo dopo i gate R-A/R-B; verifica a zero riferimenti con gli strumenti simbolici |
| Retry-After HTTP-date | Parse allineato a `source.ts` (entrambi i formati) |

---

## Piano: Live Online di Default (MVT pinnata, consenso implicito)

Data: 2026-09-17. Baseline codice: `4142db4`. Commit finale: `9e72120`.
Result: `docs/results/LIVE-ONLINE-DEFAULT-RESULT.md`. ADR: ADR-012
(supersede ADR-009).

### Obiettivo

La modalità live parte online al load con una sorgente vettoriale (MVT)
pinnata e consenso implicito non revocabile: provider e endpoint restano
fuori dall'input utente, l'opt-out dalla rete è la scelta esplicita della
modalità offline, e i provider opt-in `osm`/`http` restano subordinati
all'allowlist di endpoint.

### Task

| Stato | ID | Esito verificabile |
| --- | --- | --- |
| [x] | ONLINE-DEFAULT-01 | `live-config.ts` online di default su MVT pinnata; opt-out offline; allowlist per i provider opt-in |
| [x] | ONLINE-DEFAULT-02 | `live-controls.ts` senza campi provider/endpoint; consenso fisso (checked + disabled); nessun `stop(revoked)` |
| [x] | ONLINE-DEFAULT-03 | `bootstrap.ts` nuove firme (`stopCurrent`, `load`, `offline`); percorsi e E2E aggiornati |
| [x] | ONLINE-DEFAULT-04 | ADR-012 creato, ADR-009 superseded; `SECURITY.md`/`README.md` riallineati |

### Checkpoint

- [x] Live online al load con MVT pinnata; offline senza richieste provider.
- [x] Consenso implicito non revocabile; provider opt-in solo in allowlist.
- [x] Suite completa, typecheck, build, E2E verdi.

---

## Piano: Controlli Touch Mobile (pulsanti, zoom e nomi vie)

Data: 2026-09-17. Baseline codice: `9e72120`. Commit finale: `4ba08f2`
(pulsanti/zoom/street), `f828a14` (indurimento E2E misurazioni). Result:
`docs/results/TOUCH-CONTROLS-RESULT.md`.

### Obiettivo

Su dispositivo touch, pulsanti on-screen per guidare (stesso comportamento
della tastiera), barra zoom ingrandita con tasto `street` per i nomi delle
vie, e pannello configurazioni che non sovrappone la barra zoom. Il desktop
resta invariato.

### Task

| Stato | ID | Esito verificabile |
| --- | --- | --- |
| [x] | TOUCH-01 | `touch-controls.ts` (modulo puro + test): mapping `gas/reverse/left/right` → `w/s/a/d` |
| [x] | TOUCH-02 | `bootstrap.ts`: pulsanti on-screen, barra zoom verticale, tasto `street` (effetto `L`) |
| [x] | TOUCH-03 | `live-controls.ts`: pannello `box-sizing:border-box` + larghezza via `isTouchDevice()` (no overlap) |
| [x] | TOUCH-04 | E2E `touch-controls.spec.ts` (contesto touch) + indurimento `measurements.spec.ts` |

### Checkpoint

- [x] Pulsanti guidano; `street` alterna i nomi; pannello non sovrappone la barra zoom.
- [x] Desktop invariato (nessun pulsante, barra compatta).
- [x] Suite completa, typecheck, build, E2E verdi.

---

## Piano: Veicolo F1 (velocità, sprite e stabilità di guida)

Data: 2026-09-17. Baseline codice: `f828a14`. Commit: `33bf6bf` (velocità +
sprite F1), `568dcc0` (fix zig-zag). Result:
`docs/results/F1-VEHICLE-RESULT.md`.

### Obiettivo

Aumentare la velocità dell'auto (~150 km/h) e modellarla in vista dall'alto come
una Formula 1. Rendere i valori di guida esposti (pronti per futura UI) e
riparare il drift/zig-zag che la velocità raddoppiata ha messo in evidenza.

### Task

| Stato | ID | Esito verificabile |
| --- | --- | --- |
| [x] | F1-01 | `controller.ts`: `VEHICLE_TUNING` (top speed 42 m/s, accel 13, freno 20); `stepVehicle(..., tuning)` overridable; spec aggiornata |
| [x] | F1-02 | `renderer.ts`: `drawF1Vehicle` (naso, side pod, 4 ruote, ali, casco) al posto del rettangolo; `renderer-labels` mock `circle` |
| [x] | F1-03 | `adapter.ts`: controller autorevole per velocità+rotazione, Rapier solo posizione, attrito 0, `angvel` resettato |
| [x] | F1-04 | Test di regressione drift (muro angolato, throttle-only) + gate completa verde |

### Checkpoint

- [x] Dritto su strada libera con solo acceleratore (0° di drift di heading).
- [x] Sprite top-down F1 riconoscibile (verificato a schermo).
- [x] Suite completa, typecheck, build, E2E verdi.

---

## Piano: Zoom Ravvicinato (look GTA 1)

Data: 2026-09-17. Baseline codice: `568dcc0`. Spec:
`docs/specs/close-zoom-v1.md`.

### Obiettivo

Consentire di zoomare fino a un livello "avvicinato" stile GTA 1 (~30–40 px/m,
auto grande) con strisce di carreggiata tratteggiate, marciapiedi attorno alle
strade e facciate edifici. Il look distante (default) resta invariato.
Fattibile senza nuove fonti di dati: marciapiede e strisce derivano da
`centerline` + `widthMeters` già presenti nel chunk compilato.

### Task

| Stato | ID | Dipendenze | Taglia | Esito verificabile |
| --- | --- | --- | --- | --- |
| [x] | CZ-01 | Nessuna | S | `ZOOM_STEPS` alto (4.0, 14.0); default resta 1.0; mapping LOD invariato; `camera.test.ts` verde |
| [x] | CZ-02 | CZ-01 | M | `sidewalkLayer` grigio attorno alle strade su medium/near; `presentationDiagnostics().sidewalks` |
| [x] | CZ-03 | CZ-01 | M | Helper `dashSegments` + `roadMarkingLayer` tratteggio dal tier medium in su (visibile nel gioco normale, min ~1.5 px); `presentationDiagnostics().roadMarkings` |
| [x] | CZ-04 | CZ-02, CZ-03 | M | Screenshot zoom ravvicinato (auto grande, strisce, marciapiedi) + gate completa verde (426 unit, 25 e2e) |
| [x] | CZ-05 | CZ-04 | S | `docs/results/CLOSE-ZOOM-RESULT.md` + `CURRENT.md` fase/baseline + `README.md` baseline |

### Checkpoint

- [x] Zoom ravvicinato raggiungibile (tasto `+` fino al livello 4); default invariato.
- [x] A zoom ravvicinato: auto grande, strisce tratteggiate, marciapiedi (verificato a schermo).
- [x] Suite completa (426), typecheck, build, E2E (25) verdi.

### Rischi

| Rischio | Gestione |
| --- | --- |
| Fattore 4 fuori range rispetto al riferimento | Fattore "experimental": ricalibro su screenshot (CZ-04) |
| Tratteggio granulare a schermi grandi | Lunghezza in metri (non px): scala con lo zoom, costante nel mondo |
| Marciapiedi si sovrappongono agli incroci | Stroke round: si fondono in un'unica sagoma |
| Performance a zoom ravvicinato | Area visibile piccola (pochi chunk): più leggera del lontano |

## Piano: Dettaglio Mondo GTA (classi già nel chunk)

Data: 2026-09-18. Baseline codice: working tree post `568dcc0` (+ close-zoom
uncommitted). Spec: `docs/specs/gta-world-detail-v1.md`.

### Obiettivo

Mantenendo il **preset GTA**, ri-renderizzare le `styleKey` di classe già presenti nel
chunk (`landClass`, `roadClass`, `buildingType`, `waterClass`) con helper puri in
`renderer.ts`. Dato (verificato): il provider live MVT varia `roadClass`/`landClass` ma
ha `buildingType="unknown"` e `trees=∅`; l'OSM/Overpass popola tutto. L'edificio usa
variabilità deterministica da posizione (funziona in MVT e OSM, niente cuciture tra tile).
Alberi/levels/lanes = follow-up (cambio schema codec).

### Task

| Stato | ID | Dipendenze | Taglia | Esito verificabile |
| --- | --- | --- | --- | --- |
| [x] | WD-01 | Nessuna | M | Helper puri `groundFill`/`roadStyle`/`buildingStyle`/`positionSeed` in `renderer.ts` + test (distinti per classe, buildingStyle deterministico, seed stabile) |
| [x] | WD-02 | WD-01 | M | Wiring renderer: terreno/strada/edificio usano gli helper; `groupRoadsByStyleAndWidth`; nessun nuovo layer/campo/LOD |
| [x] | WD-03 | WD-02 | M | Gate completa verde (434 unit, 25 e2e) + screenshot tier vicino (strada per classe, niente crash) |
| [x] | WD-04 | WD-03 | S | `GTA-WORLD-DETAIL-RESULT.md` scritto; `CURRENT.md`/`README.md` baseline al commit |
| [ ] | WD-05 | (follow-up) | L | Alberi + `sourceLevels`/`laneCount` nel compilato (cambio schema) + render (benefici OSM) |

### Checkpoint

- [x] Strade con emfasi per classe (screenshot: strada `residential` col tono della classe).
- [x] Tetti colorati vari GTA, stabili tra tile (unit `buildingStyle`/`positionSeed`; disegnati senza errori dall'e2e).
- [x] Palette terreno per `landClass` (unit: colori distinti; il fixture non ha landuse, la varietà si apprezza su mappa reale).
- [x] Suite completa (434), typecheck, build, E2E (25) verdi + screenshot.

### Rischi

| Rischio | Gestione |
| --- | --- |
| MVT buildingType="unknown" → no varietà da tipo | Variabilità deterministica da posizione (seed) |
| Cuciture colore tra tile per lo stesso edificio | Seed da posizione mondiale quantizzata (non dal featureId tile-dipendente) |
| Palette troppo "Google" | Valori GTA mute/terrosi; verifica a schermo |

---

## Piano: Fisica Veicolo (peso, derapata, reazione, +40% velocità)

Data: 2026-09-18. Baseline codice: `bc635c6`. Spec:
`docs/specs/vehicle-physics-v1.md`. Result:
`docs/results/VEHICLE-PHYSICS-RESULT.md`.

### Obiettivo

Dare al veicolo un "peso" percepibile (niente galleggiamento) e una reazione
legata alla fisica, movimenti più realistici, e velocità massima super-fast
(prima richiesta +40% → 58.8 m/s; poi alzata a 84 m/s / ~302 km/h).
Resto nel controller arcade puro (`controller.ts`): curva motore, grip/derapata
per velocità, coasting più pesante, ribilanciamento tuning; più un leggero skew
della scocca in curva (`renderer.ts`). Niente cambio di schema, niente nuova
fisica di contatto, niente modifiche a collider/spawn/fixed-step.

### Task

| Stato | ID | Dipendenze | Taglia | Esito verificabile |
| --- | --- | --- | --- | --- |
| [x] | VP-01 | Nessuna | M | `controller.ts`: curva motore + grip/derapata per velocità + coasting pesante + `VEHICLE_TUNING` (super-fast, `maxForwardSpeed 84`); `controller.test.ts` verde (vmax, curva motore, derapata per velocità) |
| [x] | VP-02 | VP-01 | S | `renderer.ts`: skew della scocca da velocità laterale (`updateVehicle` + `velocity` opzionale); skew=0 a dritta, e2e rendering/driving verde |
| [x] | VP-03 | VP-01, VP-02 | M | Gate: typecheck, 437/438 unit (1 flaky da carico, verde in isolamento), build, e2e non-flaky (8) verdi + screenshot curva a zoom ravvicinato |
| [x] | VP-04 | VP-03 | S | `VEHICLE-PHYSICS-RESULT.md` + `CURRENT.md` fase/baseline + commit (`15685e5`/`a57c372`/`28fe0ee`/`62b9771`) |

### Checkpoint

- [x] L'auto accelera con curva motore (non rampa lineare), scivola in derapata a velocità
      (derapata ~16° a 50 m/s, ~10° a bassa velocità = agganciata), e coasting più pesante.
- [x] Velocità massima ~302 km/h (super-fast, `maxForwardSpeed 84`).
- [x] Su curva a velocità: flessione visiva della scocca (skew da velocità laterale) + derapata.
- [x] Suite: typecheck, 437/438 unit (1 flaky da carico, verde in isolamento), build, E2E non-flaky (8) verdi.

### Rischi

| Rischio | Gestione |
| --- | --- |
| "Feel" soggettivo (quanto drift/peso) | Tutti i valori in `VEHICLE_TUNING` (ritocco rapido); screenshot + invio a ritocchi |
| `adapter.test.ts` (reverse) sensibile al tuning | reverseAcceleration rialzato (14); test di regressione drift invariato |
| Skew troppo forte/falso | Effetto sottile, clamped; solo da velocità laterale (0 a dritta) |

## Piano: Look Veicolo "General Lee" (berlina rossa, ombra a terra, decal nitide)

Data: 2026-09-18. Baseline codice: `28fe0ee`. Result:
`docs/results/GENERAL-LEE-VEHICLE-RESULT.md`.

### Obiettivo

Rifare lo sprite dell'auto (prima F1) perché richiami il "General Lee", la Dodge
Charger 1969 di *The Dukes of Hazzard* (la macchina dei due cugini Duke): scocca
rossa, 4 ruote, parabrezza + finestrino posteriore, fari/stop, scritta
"GENERAL LEE" sul tetto e "01" sulle porte. In più ridurre l'effetto
galleggiamento: ombra morbida a terra sotto la scocca che si sposta con la piega
in curva (auto appoggiata e inclinata, non flottante). Tutto in `renderer.ts`;
niente cambio di fisica (già in `controller.ts`), niente collider/spawn.

### Task

| Stato | ID | Dipendenze | Taglia | Esito verificabile |
| --- | --- | --- | --- | --- |
| [x] | GL-01 | Nessuna | M | `renderer.ts`: `drawGeneralLee` (red Charger: scocca rossa, 4 ruote, parabrezza/finestrino, fari/stop) al posto di `drawF1Vehicle`; `renderer.test.ts` verde (centro scocca, 4 ruote, footprint) |
| [x] | GL-02 | GL-01 | M | Ombra a terra: `vehicle` → Container(ombra + gruppo scocca); ombra morbida (alpha 0.16) che scivola contro la piega; `VEHICLE_VISUAL_SCALE` 2.6 → 3.0 (scocca più leggibile) |
| [x] | GL-03 | GL-01, GL-02 | M | Decal nitide "GENERAL LEE" (tetto) + "01" (porte) via `makeWorldText` (Text rasterizzata a 128px poi ridimensionata → nitida allo zoom ravvicinato, non la banda sfocata di un Text 1x ingrandito) |
| [x] | GL-04 | GL-01..03 | M | Gate: typecheck, 438/438 unit, build, e2e non-flaky (8) verdi + screenshot nitido; fix `renderer-labels.test.ts` (baseline = decal dell'auto, così il conteggio label resta pulito) |

### Checkpoint

- [x] L'auto è una berlina rossa (Dodge Charger) riconoscibile, non più una F1.
- [x] Scritta "GENERAL LEE" sul tetto + "01" sulle porte, nitide a zoom ravvicinato.
- [x] Ombra morbida a terra sotto la scocca (riduce il galleggiamento); si sposta con la piega in curva.
- [x] Suite: typecheck, 438/438 unit, build, E2E non-flaky (8) verdi + screenshot.

### Rischi

| Rischio | Gestione |
| --- | --- |
| Testo nel mondo sfocato allo zoom (texture 1x ingrandita ~26×) | `makeWorldText`: rasterizza a 128px poi scala in basso → nitido a ogni zoom |
| Conteggio label nei test contaminate dalle decal dell'auto | `renderer-labels.test.ts` usa una baseline (decal create all'iniz) e asserisce sui delta |
| Scocca più grande (scale 3.0) | Solo visiva (il collider resta in `shape.ts`); auto più presente, tipo GTA |

---

## Piano: Zoom intermedio (overview → guida)

Data: 2026-09-21. Baseline codice: working tree post `df5be7b` (G2D-01).
Result: `docs/results/INTERMEDIATE-ZOOM-RESULT.md`.

### Obiettivo

Il salto di zoom tra l'overview (×0.85) e il preset di guida (×6.0) era 7x:
un clic `+` passava da "quartiere" a "strada" senza vista intermedia.
Richiesta utente (screenshot MVT live): uno zoom intermedio tra i due.
Scala a 6 livelli `[0.7, 0.85, 2.25, 6.0, 12.0, 24.0]`: il livello 2 (×2.25,
mediana geometrica di 0.85 e 6.0) divide il salto in due passi ~2.6x; ogni
passo resta sotto 3x. Default invariato sul preset di guida (ora livello 3,
fattore 6.0): la resa visiva di partenza non cambia. Solo presentazione:
fisica, posa veicolo, contratti chunk e streaming invariati.

### Task

| Stato | ID | Esito verificabile |
| --- | --- | --- |
| [x] | ZI-01 | `camera.ts`: `ZoomLevel 0..5`, `ZOOM_STEPS` con intermedio 2.25, `DEFAULT_ZOOM_LEVEL 3` exportato, `lodForZoom` 0-1 far / 2-3 medium / 4-5 near; unit test (passi <3x, preset separato, tier) |
| [x] | ZI-02 | `renderer.ts`/`bootstrap.ts` default 3 + clamp 5; e2e zoom/streaming/gta-city e mock allineati; gate completa verde (440 unit, typecheck, build, 27 e2e + 1 canary skip) |
| [x] | ZI-03 | Docs: result, README (zoom 6 livelli), piano/todo, log esecuzione, CURRENT.md |

### Checkpoint

- [x] Vista intermedia raggiungibile con un `+` dall'overview (×2.25).
- [x] Default visivo invariato (preset di guida ×6.0, ora livello 3); misure pixel gta-city stabili.
- [x] Suite completa, typecheck, build, E2E verdi.

### Rischi e scelte esplicite

| Rischio | Gestione |
| --- | --- |
| Renumera i livelli (2→3, 3→4, 4→5): consumer esterni | Tutti i consumer sono in-repo (renderer, bootstrap, test); il default resta il preset ×6.0, quindi la resa visiva iniziale è identica |
| Fattore 2.25 sperimentale | Parametro in `ZOOM_STEPS`: ricalibrabile senza toccare i contratti (guard unit "passi <3x" + G2D-16/18) |
| Tier del livello intermedio | medium (facciate 0.6, casing, label >= 60): coerente con il vecchio livello 2 e monotono (mai dettaglio in meno zoomando in) |

---

## Piano: Nomi via leggibili (dentro la carreggiata)

Data: 2026-09-21. Baseline codice: working tree post ZI (zoom intermedio, non
ancora commitato). Result: `docs/results/LEGIBLE-ROAD-LABELS-RESULT.md`.

### Obiettivo

Il nome della via risultava praticamente illeggibile (screenshot MVT live al
zoom intermedio): `Text` Pixi con `fontSize: 10` in unità di mondo (metri)
rasterizzata a 1x e poi ingrandita ~6x dal viewScale → banda sfocata; lo
stroke bianco da 2px copriva il fill nero; l'altezza (10 m) superava la
carreggiata (6 m) → il nome escombeva fuori dalla strada. Richiesta utente:
font più piccolo, caratteri chiari, testo compreso nella carreggiata. Solo
presentazione: contratto chunk, gate LOD, fisica e streaming invariati.

Scelte:

- Il testo è rasterizzato una volta a `LABEL_RASTER_SIZE = 128` px (design) e
  poi scalato in unità di mondo: downsampling → nitido a ogni viewScale
  (stesso principio dei decal "GENERAL LEE", GL-03).
- Altezza = 42% della larghezza della strada (clamp 1.2–4 m); label "place"
  (parchi/acque/palazzi) fisse a 3 m.
- Se il nome è più lungo di 80% della strada, `labelFitScale` riduce
  ulteriormente per farlo rientrare.
- Fill bianco + contorno scuro sottile (~5% dell'altezza): caratteri chiari,
  leggibili sia sull'asfalto scuro sia sul suolo chiaro.

### Task

| Stato | ID | Dipendenze | Taglia | Esito verificabile |
| --- | --- | --- | --- | --- |
| [x] | LB-01 | Nessuna | M | `renderer.ts`: helper puri esportati `labelWorldHeightM`, `labelFitScale`, `polylineLengthMeters` + unit test (altezza % carreggiata, clamp 1.2–4 m, place 3 m, fit 80% lunghezza, lunghezza polilinea) |
| [x] | LB-02 | LB-01 | M | `rebuildLabels`: stile 128px bianco + contorno scuro; `text.scale` da helper (road → `widthMeters`+lunghezza centerline da `chunk.roads[featureId]`); `renderer-labels.test.ts` (scale atteso road 6 m, place, strada corta) + e2e `renderer-streaming` (scale label in (0, 0.1) a tier near) |
| [x] | LB-03 | LB-02 | S | Gate completa verde (unit, typecheck, build, e2e) + docs: result, piano/todo, log esecuzione, CURRENT.md |

### Checkpoint

- [x] Il nome della via è nitido (non banda sfocata) a ogni zoom con label visibili.
- [x] L'altezza del testo sta dentro la carreggiata (strada 6 m → ~2.5 m; 3.5 m → ~1.5 m).
- [x] Caratteri chiari (bianco con contorno sottile) leggibili su asfalto e suolo.
- [x] Suite completa, typecheck, build, E2E verdi.

### Rischi e scelte esplicite

| Rischio | Gestione |
| --- | --- |
| Texture 128px per label: memoria con molti nomi | Le label sono gate da LOD (MEDIUM ≥ 60, NEAR tutte) e distrutte/ricostruite al cambio di tier; dimensione texture ~caratteri×128 px (pochi MB in città) |
| Raster 128px a risoluzione 1: leggero upscale a zoom estremo (near su 4K) | Trade-off accettato: lo zoom d'uso (overview→guida) è downsampling → nitidezza massima; il near resta leggibile |
| Nome lungo su strada corta | `labelFitScale` riduce lo scale fino al 80% della lunghezza strada |
| Change visiva netta (era illeggibile) | Screenshot e2e gta-city aggiornano la baseline; nessun assert di conteggio label toccato |

---

## Piano: Nomi via/luoghi duplicati (dedup per feature)

Data: 2026-09-21. Baseline: working tree post LB (nomi leggibili, non ancora
commitato). Result: `docs/results/NO-DUPLICATE-LABELS-RESULT.md`.

### Obiettivo

Verifica richiesta dall'utente: "ho l'impressione che non funzioni, che
duplichi i nomi via". Confermato: ogni chunk compila un box ±300 m (una
cella) e ogni chunk attraversato da una via/nei confronti di un luogo produce
la propria copia del label (OSM: `normalizeOsm` spezza le way in `part:N`
conservando il nome; `compileRegion` emette un label per feature;
`partitionCompiledChunk` filtra per posizione, ma le copie hanno posizioni
diverse) → il nome si ripete una volta per chunk (~600 m) e le way ad anello
duplicano anche dentro lo stesso chunk. MVT: analogo (merge per chunk + metà
poligono `#hN` che conservano il nome).

Scelta: dedup nel renderer (`rebuildLabels`, unico punto che vede tutti i
chunk attivi insieme): una sola copia per identità di feature stabile
(featureId senza il suffisso per-chunk `:part:N` / `#pN`/`#hN`/`#aN`/`#wN`),
vince la copia più vicina al bersaglio camera (il nome resta nello schermo).
Nessuna modifica al contratto chunk, al normalizer o alla cache persistente.

### Task

| Stato | ID | Dipendenze | Taglia | Esito verificabile |
| --- | --- | --- | --- | --- |
| [x] | ND-01 | Nessuna | S | `renderer.ts`: helper puro esportato `labelDedupKey` (strip `:part:N` OSM e `#<p|h|a|w>N` MVT, id nudi invariati) + unit test (inclusi id senza suffisso e id con suffisso multi-digit) |
| [x] | ND-02 | ND-01 | M | `rebuildLabels`: dedup per `labelDedupKey` tra i chunk attivi, vince la copia più vicina a `position` (camera target); `renderer-labels.test.ts` (2 chunk stessa feature → 1 Text, vince la più vicina; feature distinte → entrambi) + e2e `renderer-streaming` (2 chunk, stesso featureId, 1 Text totale) |
| [x] | ND-03 | ND-02 | S | Gate completa verde (unit, typecheck, build, e2e) + docs: result, piano/todo, log esecuzione, CURRENT.md |

### Checkpoint

- [x] Una via che attraversa N chunk mostra il nome una sola volta (la copia più vicina alla camera).
- [x] Nomi di luoghi (parchi/acque/edifici) condivisi tra chunk: una sola copia.
- [x] Due feature distinte con lo stesso testo restano entrambe (dedup per identità, non per testo).
- [x] Suite completa, typecheck, build, E2E verdi.

### Rischi e scelte esplicite

| Rischio | Gestione |
| --- | --- |
| Falso merge: due feature distinte con lo stesso key | Impossibile per feature con sourceId (OSM/MVT: l'id include l'id OSM); gli id sintetici senza sourceId (`tile-scoped:iN`) sono feature anonime senza label |
| Way ad anello con 2 parti nello stesso chunk: 2 copie con key diversa pre-strip, ma uguale post-strip | Il post-strip unifica le parti della stessa way → 1 copia anche intra-chunk |
| La copia "vincente" cambia al cambio di chunk attivo | Comportamento atteso: il nome segue il tratto vicino alla camera, come nelle mappe reali per-tile |
| Count `presentationDiagnostics().labels` | Invariato: conta il set per-chunk filtrato da LOD, non i Text creati (già documentato nel renderer) |

---

## Un nome per via (dedup per nome normalizzato)

Data: 2026-09-21. Baseline: working tree post ND (non ancora commitato).
Result: `docs/results/ONE-NAME-PER-ROAD-RESULT.md`.

Review del pipeline nomi (reperimento→assegnazione→visualizzazione):
- Reperimento MVT OK: join `transportation_name` per id OSM verificato su tile
  reale (151/585 strade nominate, 0 id duplicati, 0 name mal assegnati).
- Assegnazione difettosa: un label per **way** OSM, ma il nome è attributo
  della **via**: una via fatta di più way (segmenti, doppia carreggiata,
  coppie senso unico; su tile reale: `Via Merine` = 2 way, `Viale Giacomo
  Leopardi` = 2 way, più varianti di casing `Viale venticinque luglio`)
  produce N label con lo stesso nome su strade apparentemente distinte.
- Visualizzazione: il dedup ND per identità di feature non mergea way
  distinte con lo stesso nome.

Scelta: dedup nel renderer (`rebuildLabels`) per **nome normalizzato**
(trim + collapse whitespace + casefold), vince la copia più vicina al
bersaglio camera. Subsume il dedup per identità (stessa feature ⇒ stesso
testo). Provider-agnostic (MVT e OSM). `labelDedupKey` rimosso (morto).

### Task

| Stato | ID | Dipendenze | Taglia | Esito verificabile |
| --- | --- | --- | --- | --- |
| [x] | NN-01 | Nessuna | S | `renderer.ts`: helper puro esportato `labelTextKey` (trim, collapse whitespace, casefold) + unit test; test RED: 2 feature distinte stesso nome → 1 Text (vince la più vicina); varianti di casing → 1 Text; nomi distinti → 2 Text |
| [x] | NN-02 | NN-01 | M | `rebuildLabels`: chiave di dedup = `labelTextKey(label.text)`; rimozione `labelDedupKey`; test aggiornati (il vecchio "feature distinte stesso nome → entrambi" rovesciato) |
| [x] | NN-03 | NN-02 | S | Gate completa verde (unit, typecheck, build, e2e, `git diff --check`) + docs: result, piano/todo, log esecuzione, CURRENT.md |

### Checkpoint

- [x] Stessa via composta da N way OSM (o varianti di casing del nome): 1 solo label visibile, sul tratto più vicino alla camera.
- [x] Vie diverse con nomi diversi: tutti i label presenti (nessuna soppressione eccessiva).
- [x] Dedup ND per chunk (stessa feature, `:part:N`/`#pN`) invariato: 1 copia.
- [x] Suite completa, typecheck, build, E2E verdi.

### Rischi e scelte esplicite

| Rischio | Gestione |
| --- | --- |
| Due vie davvero distinte con lo stesso nome in viewport: solo la più vicina etichettata | Scelta esplicita (comportamento mappa reale: un nome per via per viewport); è esattamente il difetto segnalato |
| Merge tra `kind` (es. via e piazza omonime) | Accettato: stesso nome → 1 label, posizionato sul tratto/centroide più vicino alla camera |
| `labelDedupKey` rimosso: documentazione ND | Il result doc ND resta storico; il nuovo result doc spiega la sostituzione |

---

## Origine di gioco per nome del luogo (geocoding)

Data: 2026-09-21. Baseline: `59c17c5` (working tree pulito).
Spec: `docs/specs/place-name-origin-v1.md` (approvata dall'utente).
Result: `docs/results/PLACE-NAME-ORIGIN-RESULT.md`.

Campo "Cerca un luogo" nel form di avvio tra Modalità e coordinate: debounce
400 ms + min 2 caratteri, ≤ 5 candidati Nominatim (endpoint pinnato,
`format=jsonv2`, `accept-language=it`), 1 richiesta in-flight con abort,
cache in-memory per query, validazione rigida dei candidati, selezione
(click/tastiera) → valorizza i campi lat/lon (restano editabili), offline →
disabilitato. Contratto di avvio e consenso invariati.

### Task

| Stato | ID | Dipendenze | Taglia | Esito verificabile |
| --- | --- | --- | --- | --- |
| [x] | PN-01 | Nessuna | M | `src/app/geocode.ts`: `createGeocodeClient` (fetcher/timeout/budget iniettabili, URLParams, `readBoundedJson`, errori tipizzati network/http/rate-limited/timeout/invalid-response/aborted, validazione per-candidato con scarto, slice maxCandidates, cache LRU ≤ 32 per query normalizzata, query vuota → []) + `NOMINATIM_SEARCH_URL` + unit test completo (RED prima) |
| [x] | PN-02 | PN-01 | M | `tests/e2e/place-search.spec.ts` (RED): page.route mock Nominatim + tile — lista candidati, selezione → lat/lon valorizzati + Avvia → tile centrale = `latLonToTile(lat, lon, 14)`, 1 carattere → 0 richieste, 429 → messaggio e lat/lon invariati, timeout → messaggio, offline → campo disabilitato |
| [x] | PN-03 | PN-02 | M | `live-controls.ts`: campo "Cerca un luogo" (combobox/listbox, `textContent` solo), debounce 400 ms + min 2 char, abort in-flight, stato inline per codice errore, selezione click/Enter/frecce/Esc → lat/lon + stato risolto (nome, readOnly; click ri-edita), `syncCoordinates` estesa a offline; e2e PN-02 verde |
| [x] | PN-04 | PN-03 | S | Gate completa (unit, typecheck, build, e2e, `git diff --check`) + docs: SECURITY.md (riga "Richieste geocoding"), result, log esecuzione, CURRENT.md |

### Checkpoint

- [x] Esempio utente: "taranto" → scelgo "Taranto, …" → lat/lon = 40,4644 / 17,2477 → Avvia richiede il tile centrale di Taranto.
- [x] Nessun URL costruito da input utente (endpoint pinnato); testo candidato solo via `textContent`; offline = zero richieste geocoding.
- [x] Payload difettosi → stati di errore testuali, mai valori corrotti né crash.
- [x] Suite completa, typecheck, build, E2E verdi.

### Rischi e scelte esplicite

| Rischio | Gestione |
| --- | --- |
| Nominatim policy (1 req/s, UA) | Debounce + 1 in-flight + cache + limit=5; e2e mocka via `page.route` (nessun carico sul servizio) |
| E2E dipendente dalla rete | Nominatim e tile MVT intercettati con `page.route`: test deterministico; i tile restanti si abortono dopo l'assert |
| Complessità a11y combobox | Pattern `combobox`/`listbox` minimo + test da tastiera in e2e (frecce/Enter/Esc) |

---

## Veicolo: velocità -20% e divieto d'ingresso in acqua

Data: 2026-09-21. Baseline: `04d2b64` (working tree pulito).
Richiesta utente: "diminuisci un pochino la velocità (20%) e non consentire
l'ingresso in acqua".

### Task

| Stato | ID | Dipendenze | Taglia | Esito verificabile |
| --- | --- | --- | --- | --- |
| [x] | WS-01 | Nessuna | S | `VEHICLE_TUNING`: `maxForwardSpeed` 84 → 67.2, `maxReverseSpeed` 14 → 11.2 (top speed -20%, accelerazioni e grip invariati); asserzioni top speed in `controller.test.ts` aggiornate (RED prima) |
| [x] | WS-02 | Nessuna | M | `compileRegion`: ogni water **area** emette anche una collision shape poligonale (muro perimetrale, come gli edifici; i corsi d'acqua solo-a-linea non generano collisione); test in `compiled.test.ts` (RED prima); il blocco dell'attraversamento è garantito dai muri poligonali già testati nell'adapter Rapier |

### Checkpoint

- [x] Top speed ≈ 67.2 m/s (~242 km/h), inversa 11.2 m/s; feel invariato (accel/grip/steer intatti).
- [x] Il veicolo non attraversa mai il perimetro di una water area (compilatore + adapter).
- [x] Suite completa, typecheck, build, E2E verdi.

---

## Nome del luogo corrente nello stato di sessione

Data: 2026-09-21. Baseline: `04d2b64` + working tree con la tranche WS
(velocità/acqua) ancora da commitare — i commit WS e ZP restano separati.
Spec: `docs/specs/current-place-name-v1.md` (approvata con "procedi").
Result: `docs/results/CURRENT-PLACE-NAME-RESULT.md`.

Nello stato `ready` la barra `#session-status` mostra il luogo corrente
(reverse geocoding Nominatim al cambio di zona 1000 m, intervallo min 5 s,
1 in-flight con abort) al posto di "Area pronta"; errori silenziosi (si
mantiene l'ultimo nome), offline = zero richieste.

### Task

| Stato | ID | Dipendenze | Taglia | Esito verificabile |
| --- | --- | --- | --- | --- |
| [x] | ZP-01 | Nessuna | M | `geocode.ts`: `NOMINATIM_REVERSE_URL` pinnato + `reverse(lat, lon, signal?)` → `GeocodeCandidate | undefined` (`{error}` → undefined; stesso impianto errori/timeout/budget di search; lat/lon del candidato = valori richiesti; nessuna cache) + unit (RED prima) |
| [x] | ZP-02 | ZP-01 | M | `src/app/place-status.ts`: `PLACE_ZONE_METERS=1000`, `zoneKeyForPose` (pure), `createPlaceTracker({reverse, toLonLat, minIntervalMs=5000, cellSizeMeters, clock})` → `track/place/dispose` (1 richiesta per zona, intervallo con retry pendente, abort precedente, errore mantiene il nome, `place()` undefined finché non c'è un successo) + unit (RED prima) |
| [x] | ZP-03 | ZP-02 | M | `bootstrap.ts`: tracker solo per open-world (proiettore una volta, `toLonLat` da `unproject`), `updateStatus` chiama `track` e per `ready` mostra `place() ?? "Area pronta"`, `dispose` nel teardown; e2e `tests/e2e/place-status.spec.ts` (RED prima: ready+luogo mock, 500 → "Area pronta", `{error}` → "Area pronta", offline → 0 richieste) |
| [x] | ZP-04 | ZP-03 | S | Gate completa + docs: SECURITY.md (riga geocoding estesa al reverse), result, log esecuzione, CURRENT.md |

### Checkpoint

- [ ] "ready" → la barra mostra il luogo (mock "Lecce, Puglia, Italia") al posto di "Area pronta".
- [ ] A veicolo fermo al più 1 richiesta; cambio zona → 1 richiesta (max 1 ogni 5 s).
- [ ] Fallimento reverse → testo precedente mantenuto, zero pageerror; offline → zero richieste.
- [ ] Suite completa, typecheck, build, E2E verdi.

### Rischi e scelte esplicite

| Rischio | Gestione |
| --- | --- |
| Nominatim policy (1 req/s) | Trigger a zona 1000 m + intervallo 5 s + 1 in-flight; a riposo zero richieste |
| E2E "cambio zona" durante la guida non deterministico (il controller non segue le strade) | Logica del tracker coperta dai unit (clock/reverse iniettati); l'e2e verifica l'integrazione ready+luogo e gli error path |
| Tile mockati in e2e con geometria duplicata per le chiavi vicine | Solo il tile centrale serve la geometria corretta all'origine (necessaria per `ready`); i vicini non sono raggiungibili nel tempo del test |
---

## Location Visual Profiles (LVP)

Data: 2026-09-21. Baseline: `0433da1` (working tree pulito).
Spec: `docs/specs/OPEN-GTA-LOCATION-VISUAL-PROFILES-V1.md`. ADR: ADR-014.
Result: `docs/results/LOCATION-VISUAL-PROFILES-V1-RESULT.md`.

La stessa pipeline OpenGTA assume una forte identita' locale in base alla
posizione: reverse geocoding strutturato → `LocationContext`
provider-neutral → `VisualProfileResolver` → `VisualProfile` applicato dal
renderer (solo-presentazione: niente geometria, fisica o refetch). Profili
iniziali: default, italy, rome, france, paris; override di sviluppo
`?theme=auto|default|italy|rome|france|paris`.

### Task

| Stato | ID | Dipendenze | Taglia | Esito verificabile |
| --- | --- | --- | --- | --- |
| [x] | LVP-00 | Nessuna | S | ADR-014 + righe plan/todo/handoff; nessun production code |
| [x] | LVP-01 | Nessuna | M | `src/app/location-context.ts` (`LocationContext` provider-neutral + `toLocationContext` + `normalizeCountryCode`); `geocode.ts` `ReverseGeocodeResult` (`addressdetails=1`, parsing `country_code`/`state`/`city|town|village|municipality`/`city_district|borough|suburb|neighbourhood`, validazione `^[A-Z]{2}$`); `place-status.ts` `location()` (ultimo contesto valido mantenuto sul fallimento); unit in `geocode.test.ts` + `location-context.test.ts` + `place-status.test.ts` (RED prima) |
| [x] | LVP-02 | Nessuna | M | `src/render/theme/{types,hash,merge}.ts` + `profiles/default.ts` + `index.ts`: contratto `VisualProfile` completo (schemaVersion 1, ground/roads/buildings/identity), `stableStringHash` FNV-1a 32-bit, `mergeVisualProfile` esplicito (parent immutabile, map merge per chiave, palette sostituite, guard palette non vuote), default = valori correnti del renderer + unit (RED prima) |
| [x] | LVP-03 | LVP-02 | M | `profiles/{italy,rome,france,paris}.ts` (gerarchia default→italy→rome, default→france→paris) + `resolver.ts` (registry chiusa, regole locality/region/country, `normalizeLocationToken`, forzato ha precedenza assoluta, forzato non valido → auto, citta' qualificata dal paese) + `override.ts` (`?theme=` solo id della registry) + unit (RED prima) |
| [x] | LVP-04 | LVP-02 | L | `renderer.ts`: `createPixiRenderer(canvas, { visualProfile })` (default interno), `setVisualProfile`/`visualProfileId` (stesso id = no-op; id diverso = rebuild solo-presentazione dei chunk caricati, niente refetch/fisica/camera/rete), helper puri spostati in `theme/index.ts` (`groundFill`/`roadStyle`/`buildingStyle` con profilo), seed edificio = `stableStringHash(featureId:profile.id)`, background dal profilo; unit (RED prima) |
| [x] | LVP-05 | LVP-03, 04 | M | `bootstrap.ts`: resolver una volta per sessione, `?theme=` letto una volta, profilo iniziale alla creazione del renderer, `syncVisualTheme` al cambio di riferimento di `location()` nel loop 200 ms, debug snapshot `theme`/`location`; e2e `tests/e2e/location-visual-profiles.spec.ts` (forzato paris/rome, id non valido → default, auto con addressdetails mockato → locality, fallimento geocoder → profilo mantenuto, offline invariato) (RED prima) |
| [x] | LVP-06 | LVP-05 | M | Validazione visiva paris/rome a parita' di scena (screenshot, invarianza chunk/camera/zoom, nessun leak di presentazioni su paris→rome→paris→rome), verifica live Paris/Rome se la rete lo consente (altrimenti documentata), `LOCATION-VISUAL-PROFILES-V1-RESULT.md` + gate completa + CURRENT.md/README/plan/todo |

### Checkpoint

- [x] A parita' di geometria Paris e Rome appaiono chiaramente diverse (palette edifici/tetti, strade, marciapiedi, terreno, acqua) — screenshot nel result.
- [x] Cambio tema: zero refetch, zero ricompilazione, fisica/pose/camera/zoom invariati, numero di presentazioni stabile dopo piu' switch — unit fake-Pixi (7 Graphics/chunk al cambio, conteggi e camera invariati, A-B-A stabile) + e2e.
- [x] Offline/geocoder fallito: gioco continua, default o ultimo profilo valido, nessun errore nel loop, zero richieste se offline — e2e `location-visual-profiles.spec.ts`.
- [x] Il renderer non conosce Nominatim e non contiene `if rome/paris`; `CompiledChunkV0` non contiene themeId — il renderer consuma solo `VisualProfile` dal `theme/`.
- [x] Suite unit (548), typecheck, build, E2E (42 + canary skipped) verdi.

### Rischi e scelte esplicite

| Rischio | Gestione |
| --- | --- |
| `featureId` MVT non stabile tra streaming (indice per-assemblea) | Spec 15.2: si usa `featureId` in v1, finding documentato nel result + follow-up per stable visual identity provider-neutral |
| Cambio tema = rebuild completo delle presentazioni (evento raro) | Accettabile in v1 (spec 40); guard no-op sullo stesso id; mai nel RAF |
| Il default non deve regredire il look corrente | Default profile = valori correnti del renderer letterali; guard unit + e2e |
| Fake facades = campo transitorio | `facadePalette`/`typeStyles[].facade` restano nel contratto (spec 25), da deprecare con 2D+ |

### LVP-07 — Raffino profili France/Paris (gate visuale utente)

| Stato | Task | Dipende da | S | Sintesi |
| --- | --- | --- | --- | --- |
| [x] | LVP-07 | LVP-06 | S | Gate utente `docs/results/LVP-VALIDATION-RESULT.md` (GO) con osservazione: France "ancora troppo cartografico". Step 1 "stabilizzare LVP": palette France (tetti ardesia→zincato con voci calde/fredde, facciate cream/limestone/taupe con più gamma tonale) e Paris (stessa direzione, più fredda), senza saturazione in più; screenshot prima/dopo + controllo Rome invariato nel result |

### LVP-08 — Terzo profilo `tokyo` + gate a tre famiglie (LVP-2)

| Stato | Task | Dipende da | S | Sintesi |
| --- | --- | --- | --- | --- |
| [x] | LVP-08 | LVP-07 | S | Spec §56: profilo `tokyo` (concreto/acciaio/carbone) che estende `default`; resolver `JP` + locality `tokyo`; registry chiusa estesa a 6 id (`?theme=tokyo`); TDD 3 test RED → GREEN (36/36 in `src/render/theme`); e2e registry esteso; **gate a tre famiglie VALIDATO** su geometria reale comune (centro Roma live, 674 edifici, zero errori): rome/paris/tokyo distinguibili a colpo d'occhio (`/tmp/family-*.png`) → "LVP architecture = validated" |

### Next (backlog post-v1, dal gate utente, in ordine)

- [x] Re-gate visuale del raffino France/Paris (GO su scena densa reale centro Roma, 4 temi, `/tmp/regate-*.png`; coppia debole france/paris documentata).
- [ ] Validazione manuale auto-resolution end-to-end su città reali in viaggio (mock già coperta da e2e).
- [x] Terzo profilo molto diverso + validazione 3 famiglie visuali → "LVP architecture validated" (fatto con `tokyo`, LVP-08; gate rome/paris/tokyo VALIDATO).
- [ ] Solo dopo: Visual Profile Service (VisualEvidenceProfile → VisualCatalog → ProfileCompiler → fixtures → Mapillary → Vision → runtime service). **Slice offline VPS-00..03 completata (gate §140 GO, 2026-09-21; result doc dedicato)** — sezione sotto; Mapillary/Vision/runtime service da VPS-04 in poi, solo dopo il gate offline (fatto).

## Tile Budgets Live (città dense) — 2026-09-21

| Stato | Task | Dipende da | S | Sintesi |
| --- | --- | --- | --- | --- |
| [x] | TB-01 | Provider-Neutral | S | Misura tile z14 reali (Roma/Parigi/Lecce): "troppo grande" causato dai budget di decode (feature 10k / punti 50k < picchi 16,952/52,043 a Parigi) + bug `maxTileBytes` non propagato al decode |
| [x] | TB-02 | TB-01 | S | Opzioni provider `maxFeaturesPerTile`/`maxPointsPerGeometry` + passaggi ai limiti di decode; config live 16 MiB / 30k / 100k; fixture tile Parigi z14 + 2 regression test; gate 550 unit / 42 e2e + verifica live reale su Parigi. Result: `docs/results/DENSE-TILE-BUDGETS-RESULT.md` |

## Visual Profile Service (VPS) — 2026-09-21

Spec: `docs/specs/OPEN-GTA-VISUAL-PROFILE-SERVICE-V1.md`. ADR-015.
Precondizione §1 soddisfatta (LVP + tokyo validati, gate 3 famiglie GO).

| Stato | Task | Dipende da | S | Sintesi |
| --- | --- | --- | --- | --- |
| [x] | VPS-00 | LVP-08 | S | ADR-015 (strati OBSERVE/INTERPRET/COMPILE/SERVE mai fusi; core `src/vps/` puro TS; ponte contratto `GeneratedVisualProfile extends VisualProfile`; catalogo semiato dai 6 profili LVP; determinismo senza timestamp nel compiler; hook dev `?vps=`) + allineamento SPEC/plan/todo/handoff |
| [x] | VPS-01 | VPS-00 | S | Tipi evidence provider-neutral (vocabolari chiusi §21-28, `Distribution`, `EvidenceCoverage`, `VisualEvidenceProfile`) + 3 fixture offline Rome/Paris/Tokyo-like (spec §97/§140); test di validità fixture — `src/vps/evidence/`, 6/6 test |
| [x] | VPS-02 | VPS-01 | S | `VisualCatalog` minimum (spec §138: 4 facade, 4 roof, 4 sidewalk, 3 road, 3 vegetation, 3 furniture) semiato dai profili LVP; i colori veri vivono solo qui (§47) — `src/vps/catalog/`, 4/4 test, seed deep-equal da LVP |
| [x] | VPS-03 | VPS-02 | S | `ProfileCompiler` puro (spec §43-44): evidence+context→`GeneratedVisualProfile`; famiglie pesate→palette concrete deterministiche (§50-51); low-confidence <0.35 → parent (§68); id versionato `vps:v1:<cell>:c<rev>` (§53); hook dev `?vps=<fixture>` + test puri (determinismo, completezza, fallback) — `src/vps/compiler/` + `src/app/bootstrap.ts`, 9/9 test. v1: roads/ground-base/typeStyles/outline/depth2d/markings ereditano il parent (decisione documentata, see result doc) |
| [x] | VPS-GATE | VPS-03 | M | Gate slice (spec §140): 3 fixture compilate renderizzate su stessa geometria vs profili LVP rome/paris/tokyo — le 3 famiglie restano distinte e coerenti → **GO** verso VPS-04/05. Unit 569/569, typecheck, build, e2e 42+1 skip; screenshot + hash in `docs/results/VISUAL-PROFILE-SERVICE-V1-RESULT.md` |
| [x] | VPS-04 | VPS-GATE | M | Celle spaziali + cache (spec §100, §10-12, §54-57): `cellForCoordinates` deterministica (h3-js res 9 ≈ 400 m, banda MVP 300-700 m) + `EvidenceCache`/`ProfileCache` separate (§56) con chiavi `cell|schema|evidence` / `cell|schema|compiler|catalog` (§55): ricompilazione su nuovo catalogo/compiler senza rieseguire l'analisi. `src/vps/cell/`, `src/vps/cache/`, 17 test + pipeline lat/lon→cell→cache |
| [x] | VPS-05 | VPS-04 | M | OSM evidence collector (spec §101, §7/40/41/92-93/130): `collectOsmEvidence` puro da features OSM neutrali (node/way/area taggati) → `VisualEvidenceProfile`; mapping solo tag espliciti (material/colour/roof/surface/green), confidenza = classificati/osservati (OSM non taggato < 0.35 → parent, spec §40/42), pesi geometrici, densità saturate, revisione = hash input, `retrievedAt` iniettato. OSM non asserisce mai vegetazione climatica/città/furniture (→ vision, §130). `src/vps/osm/`, 11 test + end-to-end OSM→compiler (roof_tiles → terracotta-urban, spec §41) |
| [x] | VPS-06 | VPS-05 | M | Provider street-imagery (spec §102, §5/8-9/13-16/31-32/80-83): contratto neutro `StreetImageryProvider` (`sample(area, options, retrievedAt) → StreetSampleBatch`) + `selectStreetSamples` puro e deterministico (raggio 400 m, dedup, recency relativa al pool, spread spaziale 30 m + heading 45°, cap 3 heading/posizione — "5-10 posizioni × 2-3 heading" §14, mai 20 shot della stessa sequence); `TestImageryProvider` (ring sintetico seed area.id, pool iniettato) per pipeline offline; `MapillaryImageryProvider` dietro `MapillaryClient` iniettato: mapping ref→`StreetSample` con provenance piena (§16), classifiche detection mappate su canonical con passthrough delle classi ignote (§31), detections solo sui campioni selezionati (§8), `StreetImageryProviderError` tipizzato (rate-limited/unavailable/auth/invalid-response) per degradare a OSM-only→parent (§80). Nessuna credenziale/HTTP nel core: client server-side in VPS-10 (§82-83); nessuna assunzione di licenza codificata (§17). `src/vps/providers/street-imagery/`, 23 test |
| [x] | VPS-07 | VPS-06 | M | Visual analyzer (spec §103, §18-21/30/78/115): contratto `VisualAnalyzer.analyze(sample) → VisualObservation` (7 assi v1, **senza** streetFurniture — §103) + `ClassificationResult` con confidenza clippata 0..1 (§20); validatore stretto dell'output modello (§30/§78): schema chiuso con rifiuto campi extra (niente accettazione parziale), vocabolari chiusi (mai categorie inventate, §21), limite dimensione payload, `sampleId` deve matchare il campione, fallback `unknown` = nessun asse + quality 0 (mai output non validato, mai inquinare l'aggregazione); `ANALYZER_REVISION=1` (identità evidence §57/§116); `TestVisualAnalyzer` (raw per sampleId non validato a scopo, passa per lo stesso validatore del modello live) + fixture `VisualObservation[]` provider-independent §115 coerenti con i dominanti delle evidence fixture VPS-01. `src/vps/analysis/`, 19 test + wiring provider→analyzer |
| [x] | VPS-08 | VPS-07 | M | Evidence aggregator (spec §104, §33-42/130): `aggregateEvidence` puro OSM + vision + detections → `VisualEvidenceProfile`; aggregazione pesata §36 (weight = confidenza × quality × recency × spaziale × source trust), **trust per asse configurabile** §130 (default: OSM esplicito 1.0 su roof/material/colour, vegetation imagery 0.8 vs OSM 0.6, ecc.); recency a bande §37 (config, vecchio ≠ invalido); damping cluster spaziale §38 (1/√k, mai 20 foto della stessa strada); blend OSM/vision con priorità fonte §40 (OSM non taggato conf 0 → mai priorità; tie esatto → fonte prioritaria); confidenza vision = dominanza² × volume (cap 2 osservazioni); densità union OSM∪detections (vehicle ≠ parcheggiato, decisione documentata); `evidenceRevision agg:v1:a<rev>:<hash>` (ANALYZER+AGGREGATOR revision in identità, §57/§116); coverage §39 (grid 4×4 spaziale, 4 quadranti direzionali, overall = media fonti presenti). `src/vps/aggregate/`, 16 test |
| [x] | VPS-09 | VPS-08 | M | End-to-end offline Rome/Paris/Tokyo (spec §105, §109.1/5/6): pipeline `createVisualPipeline` puro che compone le layer (collect OSM + street imagery → analyze → aggregate → compile → cache → serve) con coordinate note di test per città (Roma 41.8992/12.4769, Parigi 48.8566/2.3522, Tokyo 35.6762/139.6503); fixture OSM sintetiche per città (OSM_CITY_FEATURES) + pool campioni con sampleId = fixture observations VPS-07 (passano per lo stesso validatore: raw senza provenance, spec §30); cache value-cached per revisione §55-57 (oggetto stabile, recompile mai su revisione diversa, no-shadowing); **degrado per provider failure §80/§110-111**: OSM down → vision-only, imagery down → OSM-only, tutto down → parent LVP completo, mai throw; fallback observations (quality 0) non inquinano l'aggregazione §78; 3 profili generati pairwise distinti, determinismo deep-equal. `src/vps/pipeline/`, 12 test |
