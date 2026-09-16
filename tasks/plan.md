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

- [ ] [FP-01](tasks/first-person/FP-01.md): camera 3D config (FOV, height, projection matrix)
- [ ] [FP-02](tasks/first-person/FP-02.md): road segment projector (centerline → screen segments)
- [ ] [FP-03](tasks/first-person/FP-03.md): road segment drawer (back-to-front poligoni)

### Checkpoint 1: Strada visuale
- [ ] `npm run typecheck` verde
- [ ] `npm run test:run` verde (322 test)
- [ ] Road retta visibile in prospettiva, larghezza corretta

### Phase 2: Buildings + Sky (Tasks FP-04..05)

- [ ] [FP-04](tasks/first-person/FP-04.md): building side projection (edifici laterali)
- [ ] [FP-05](tasks/first-person/FP-05.md): sky gradient (orizzonte)

### Checkpoint 2: Scena completa
- [ ] Road + edifici + cielo visibili
- [ ] Costruzione con `V` → top-down, `V` → first-person
- [ ] Nessun test rotto

### Phase 3: Integration (Tasks FP-06..07)

- [x] [FP-06](tasks/first-person/FP-06.md): first-person renderer orchestration (implementato, WIP non committo)
- [x] [FP-07](tasks/first-person/FP-07.md): V key toggle (interfaccia PixiRenderer) (implementato, WIP non committo)

### Phase 3.5: Fix vista FPV (regressione)

**Nota 2026-09-16:** l'implementazione FP-01..07 esiste nel working tree ma la
vista è rotta: la camera è ruotata di 90° rispetto all'heading (componenti
X/Z invertite) e una ground strip a `ROAD_FILL` copre la strada con lo stesso
colore. Diagnosi completa e fette di fix in
[FP-08](tasks/first-person/FP-08.md).

- [ ] [FP-08](tasks/first-person/FP-08.md): fix orientamento camera + layering ground/road + facciate edifici

### Checkpoint 3: End-to-end
- [ ] Guida completa in first-person
- [ ] Toggle V durante guida senza crash
- [ ] 60 FPS stabile per 30 secondi

### Rischi e mitigazioni

| Rischio | Impatto | Mitigazione |
|---------|---------|-------------|
| Proiezione prospettica produce artefatti | Basso | Clamp Z depth, early-out su segmenti dietro camera |
| Edifici proiettati troppo grandi | Basso | Culling laterale ±30m, max height scale |
| Performance sotto i 60fps | Alto | Disabilitare edifici se draw calls > 120 |
