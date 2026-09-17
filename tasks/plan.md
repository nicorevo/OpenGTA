# Piano: Provider-Neutral World Streaming (tranche DATA)

Data: 2026-09-11. Analisi di riferimento:
`docs/OpenGTA-DATA-SOURCE-MIGRATION.md` (migrazione Overpass → MVT/PMTiles).
Stato: pianificato; implementazione non avviata.
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

- [x] [FP-01](tasks/first-person/FP-01.md): camera 3D config (FOV, height, projection matrix)
- [x] [FP-02](tasks/first-person/FP-02.md): road segment projector (centerline → screen segments)
- [x] [FP-03](tasks/first-person/FP-03.md): road segment drawer (back-to-front poligoni)

### Checkpoint 1: Strada visuale
- [x] `npm run typecheck` verde
- [x] `npm run test:run` verde
- [x] Road retta visibile in prospettiva, larghezza corretta

### Phase 2: Buildings + Sky (Tasks FP-04..05)

- [x] [FP-04](tasks/first-person/FP-04.md): building side projection (edifici laterali)
- [x] [FP-05](tasks/first-person/FP-05.md): sky gradient (orizzonte)

### Checkpoint 2: Scena completa
- [x] Road + edifici + cielo visibili
- [x] Costruzione con `V` → top-down, `V` → first-person
- [x] Nessun test rotto

### Phase 3: Integration (Tasks FP-06..07)

- [x] [FP-06](tasks/first-person/FP-06.md): first-person renderer orchestration
- [x] [FP-07](tasks/first-person/FP-07.md): V key toggle (interfaccia PixiRenderer)

### Phase 3.5: Fix vista FPV (regressione)

**Nota 2026-09-16 (risolta):** la vista era rotta (camera ruotata di 90°
rispetto all'heading, ground strip a `ROAD_FILL` sulla strada, centerline MVT
troppo sparse, clamp asimmetrico). Diagnosi e fette di fix in
[FP-08](tasks/first-person/FP-08.md). Rework finale del modello di proiezione
completato (MVP): strade come **poligoni di piano terreno** in prospettiva
vera (`projectRoadPolygon`), edifici come **box 3D** (`projectBuildings`),
orizzonte a metà schermo con NDC reale, densificazione centerline e clamp
simmetrico. Guard permanente: `tests/e2e/first-person-view.spec.ts`.

- [x] [FP-08](tasks/first-person/FP-08.md): fix orientamento camera + layering ground/road + facciate edifici

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
