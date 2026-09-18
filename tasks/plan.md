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
| [ ] | VP-04 | VP-03 | S | `VEHICLE-PHYSICS-RESULT.md` + `CURRENT.md` fase/baseline + commit |

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
