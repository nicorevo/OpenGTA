# Checklist: GTA 2D (citta' dall'alto, strade e palazzi)

Data: 2026-09-20 (aggiornato 2026-09-21). Stato: G2D-00..01 consegnati; G2D-02..18 da fare.

Fonte: [piano](plan.md). Prima di eseguire leggere
[istruzioni e contratti comuni](gta-2d/README.md).

## Gate A: proporzioni e proiezione

- [x] [G2D-00](gta-2d/G2D-00.md): quartiere di riferimento ripetibile.
- [x] [G2D-01](gta-2d/G2D-01.md): proporzioni taxi, strada e camera.
- [ ] [G2D-02](gta-2d/G2D-02.md): prova della profondita' prospettica.

## Gate B: incrocio completo

- [ ] [G2D-03](gta-2d/G2D-03.md): asfalto con materiale continuo.
- [ ] [G2D-04](gta-2d/G2D-04.md): marciapiedi pavimentati e cordoli.
- [ ] [G2D-05](gta-2d/G2D-05.md): incroci raccordati X, T e Y.
- [ ] [G2D-06](gta-2d/G2D-06.md): segnaletica coerente con l'incrocio.

## Dati: identita', bordi e cache

- [ ] [G2D-07](gta-2d/G2D-07.md): contratto dei metadati visivi e cache.
- [ ] [G2D-08](gta-2d/G2D-08.md): provenienza dei contorni dalle tile.
- [ ] [G2D-09](gta-2d/G2D-09.md): metadati continui dopo compilazione e partizione.

## Gate C: quartiere con facciate, tetti e ombre

- [ ] [G2D-10](gta-2d/G2D-10.md): facciate modulari nel renderer di gioco.
- [ ] [G2D-11](gta-2d/G2D-11.md): tetti, cornici e dettagli degli edifici.
- [ ] [G2D-12](gta-2d/G2D-12.md): ombre e visibilita' del taxi.

## Gate D: continuita', LOD, citta' reale

- [ ] [G2D-13](gta-2d/G2D-13.md): continuita' grafica tra chunk.
- [ ] [G2D-14](gta-2d/G2D-14.md): LOD e culling della profondita'.
- [ ] [G2D-15](gta-2d/G2D-15.md): arredo urbano decorativo essenziale.
- [ ] [G2D-16](gta-2d/G2D-16.md): verifica sulla citta' reale e sulle tile MVT.

## Gate E: misure, regressioni e consegna

- [ ] [G2D-17](gta-2d/G2D-17.md): budget di rendering e lifecycle.
- [ ] [G2D-18](gta-2d/G2D-18.md): confronto finale e consegna.

# Checklist: Provider-Neutral World Streaming

Data: 2026-09-11.
Stato: completato (DATA-00..14); DATA-15..18 da dettagliare.

Fonte: [piano](plan.md). Prima di eseguire leggere
[contratti e procedura](data/README.md).

## Fondazioni

- [x] [DATA-00](data/DATA-00.md): diagnostica failure.
- [x] [DATA-01](data/DATA-01.md): fallback Overpass.
- [x] [DATA-02](data/DATA-02.md): tile math e decoder MVT.
- [x] [DATA-03](data/DATA-03.md): coverage resolver.
- [x] [DATA-04](data/DATA-04.md): provider OpenFreeMap.
- [x] [DATA-05](data/DATA-05.md): modello decodificato.
- [x] D-A: fondazioni.

## Mapping e parity

- [x] [DATA-06](data/DATA-06.md): mapping transportation.
- [x] [DATA-07](data/DATA-07.md): mapping building.
- [x] [DATA-08](data/DATA-08.md): mapping land/water.
- [x] [DATA-09](data/DATA-09.md): parity Lecce.
- [x] [DATA-10](data/DATA-10.md): benchmark.
- [x] D-B: mapping e parity.

## Runtime e seam

- [x] [DATA-11](data/DATA-11.md): runtime feature flag.
- [x] [DATA-12](data/DATA-12.md): seam tests.
- [x] [DATA-13](data/DATA-13.md): normalizer MVT.
- [x] [DATA-14](data/DATA-14.md): CanonicalRegionSource.
- [x] D-C: runtime e seam.

## Fasi successive (senza scheda: da dettagliare prima dell'esecuzione)

- [ ] DATA-15: PMTiles PoC locale.
- [ ] DATA-16: custom tile schema ADR.
- [ ] DATA-17: verifica riuso cache compilata (gia' consegnata).
- [ ] DATA-18: curated region package.

## Storico

City Drive Stable completata: [archivio](archive/2026-09-11-todo.md).

---

## First-Person Renderer (OutRun-Style)

Spec: `docs/specs/first-person-renderer-v0.md`

### Phase 1: Core Projection

- [x] [FP-01](first-person/FP-01.md): camera 3D config (FOV, height, projection matrix)
- [x] [FP-02](first-person/FP-02.md): road segment projector (centerline → screen segments)
- [x] [FP-03](first-person/FP-03.md): road segment drawer (back-to-front poligoni)

### Phase 2: Environment

- [x] [FP-04](first-person/FP-04.md): building side projection (edifici laterali)
- [x] [FP-05](first-person/FP-05.md): sky gradient (orizzonte)

### Phase 3: Integration

- [x] [FP-06](first-person/FP-06.md): first-person renderer orchestration
- [x] [FP-07](first-person/FP-07.md): V key toggle (interfaccia PixiRenderer)

### Phase 3.5: Fix vista FPV (regressione)

- [x] [FP-08](first-person/FP-08.md): fix orientamento camera (90°) + layering ground/road + facciate edifici (MVP, guard e2e)

---

## Code Review Remediation (RV)

Data: 2026-09-17. Fonte: review complessiva (baseline `ae92e10`).
Prima di eseguire leggere [contratti e procedura](review/README.md).

### P0 — da risolvere prima del merge

- [x] [RV-01](review/RV-01.md): cancel stream MVT sul budget.
- [x] [RV-03](review/RV-03.md): test bench nel gate standard.
- [x] [RV-02](review/RV-02.md): re-sync SECURITY.md.
- [x] [RV-05](review/RV-05.md): label O(1) + destroy.
- [x] [RV-04](review/RV-04.md): cache tile + concorrenza bounded + retry.
- [x] R-A: P0 (cancellazione, cache, retry, label, docs, gate).

### P1 — robustness e performance

- [x] [RV-10](review/RV-10.md): validazione codec deser.
- [x] [RV-09](review/RV-09.md): pre-filtro bbox relazioni OSM.
- [x] [RV-08](review/RV-08.md): write IndexedDB serializzate + indice.
- [x] [RV-06](review/RV-06.md): stop app Pixi inattiva al toggle.
- [x] [RV-07](review/RV-07.md): pre-cull strade FP.
- [x] R-B: robustness e performance.

### P2 — pulizia

- [x] [RV-11](review/RV-11.md): rimozione dead code.
- [x] [RV-12](review/RV-12.md): batch nits.
- [x] R-C: pulizia + gate finale.

---

## Live Online di Default (MVT pinnata, consenso implicito)

Data: 2026-09-17. Baseline: `4142db4`. Commit: `9e72120`. Result:
`docs/results/LIVE-ONLINE-DEFAULT-RESULT.md`. ADR: ADR-012.

- [x] ONLINE-DEFAULT-01: `live-config.ts` online di default su MVT pinnata + opt-out offline.
- [x] ONLINE-DEFAULT-02: `live-controls.ts` senza provider/endpoint; consenso fisso non revocabile.
- [x] ONLINE-DEFAULT-03: `bootstrap.ts` nuove firme; E2E aggiornati.
- [x] ONLINE-DEFAULT-04: ADR-012 creato, ADR-009 superseded; SECURITY/README riallineati.
- [x] C-OD: suite, typecheck, build, E2E verdi.

---

## Controlli Touch Mobile (pulsanti, zoom e nomi vie)

Data: 2026-09-17. Baseline: `9e72120`. Commit: `4ba08f2` (UI), `f828a14`
(E2E). Result: `docs/results/TOUCH-CONTROLS-RESULT.md`.

- [x] TOUCH-01: `touch-controls.ts` (modulo puro + test).
- [x] TOUCH-02: `bootstrap.ts` pulsanti on-screen + barra zoom + tasto `street`.
- [x] TOUCH-03: `live-controls.ts` pannello no-overlap (`box-sizing` + `isTouchDevice`).
- [x] TOUCH-04: E2E `touch-controls.spec.ts` + indurimento `measurements.spec.ts`.
- [x] C-TOUCH: suite, typecheck, build, E2E verdi.

---

## Veicolo F1 (velocità, sprite e stabilità di guida)

Data: 2026-09-17. Baseline: `f828a14`. Commit: `33bf6bf` (velocità + sprite),
`568dcc0` (fix zig-zag). Result: `docs/results/F1-VEHICLE-RESULT.md`.

- [x] F1-01: `controller.ts` `VEHICLE_TUNING` (top speed 42 m/s, accel 13, freno 20) + spec.
- [x] F1-02: `renderer.ts` `drawF1Vehicle` (top-down F1) + test geometria + mock `circle`.
- [x] F1-03: `adapter.ts` controller autorevole v+rotazione, Rapier solo posizione, attrito 0, `angvel` resettato.
- [x] F1-04: test di regressione drift (muro angolato, throttle-only) + gate completa verde.
- [x] C-F1: suite (419), typecheck, build, E2E (25) verdi.

---

## Zoom Ravvicinato (look GTA 1)

Data: 2026-09-17. Baseline: `568dcc0`. Spec: `docs/specs/close-zoom-v1.md`.

- [x] CZ-01: `camera.ts` `ZOOM_STEPS` alto (4.0, 14.0); default 1.0; mapping LOD invariato.
- [x] CZ-02: `renderer.ts` `sidewalkLayer` marciapiedi grigio attorno alle strade (medium/near).
- [x] CZ-03: `renderer.ts` `dashSegments` + `roadMarkingLayer` strisce tratteggiate (medium+near, min ~1.5 px).
- [x] CZ-04: screenshot zoom ravvicinato + gate completa (426 unit, typecheck, build, 25 E2E).
- [x] CZ-05: `CLOSE-ZOOM-RESULT.md` + `CURRENT.md` + `README.md` baseline.

---

## Dettaglio Mondo GTA (classi già nel chunk)

Data: 2026-09-18. Preset GTA (niente Google). Spec: `docs/specs/gta-world-detail-v1.md`.

- [x] WD-01: helper puri in `renderer.ts` — `groundFill`, `roadStyle`, `buildingStyle`, `positionSeed` + test.
- [x] WD-02: wiring renderer (terreno/strada/edificio) sugli helper; `groupRoadsByStyleAndWidth`; nessun nuovo layer/campo.
- [x] WD-03: gate completa verde (434 unit, 25 e2e) + screenshot tier vicino.
- [x] WD-04: `GTA-WORLD-DETAIL-RESULT.md` scritto; `CURRENT.md`/`README.md` baseline al commit.
- [ ] WD-05 (follow-up): alberi + `sourceLevels`/`laneCount` nel compilato (cambio schema, benefici OSM).

---

## Fisica Veicolo (peso, derapata, reazione, +40% velocità)

Data: 2026-09-18. Baseline: `bc635c6`. Spec: `docs/specs/vehicle-physics-v1.md`.
Result: `docs/results/VEHICLE-PHYSICS-RESULT.md`.

- [x] VP-01: `controller.ts` curva motore + grip/derapata per velocità + coasting pesante + `VEHICLE_TUNING` (super-fast, `maxForwardSpeed 84`); `controller.test.ts` verde.
- [x] VP-02: `renderer.ts` skew della scocca da velocità laterale (`updateVehicle` + `velocity` opzionale); plumbing `runtime-session`/`bootstrap`.
- [x] VP-03: gate verde (typecheck, 437/438 unit — 1 flaky da carico verde in isolamento, build, e2e non-flaky 8) + screenshot curva.
- [x] VP-04: commit (`15685e5`/`a57c372`/`28fe0ee`/`62b9771`) + `CURRENT.md`/`README.md` baseline.

## Look Veicolo "General Lee" (berlina rossa, ombra a terra, decal nitide)

Data: 2026-09-18. Baseline: `28fe0ee`. Result: `docs/results/GENERAL-LEE-VEHICLE-RESULT.md`.

- [x] GL-01: `renderer.ts` `drawGeneralLee` (red Charger: scocca rossa, 4 ruote, parabrezza/finestrino, fari/stop) al posto di `drawF1Vehicle`; `renderer.test.ts` verde.
- [x] GL-02: ombra a terra (Container ombra + scocca), scivola con la piega; `VEHICLE_VISUAL_SCALE` 2.6 → 3.0.
- [x] GL-03: decal nitide "GENERAL LEE" (tetto) + "01" (porte) via `makeWorldText` (rasterizza 128px poi scala).
- [x] GL-04: gate verde (typecheck, 438/438 unit, build, e2e non-flaky 8) + screenshot nitido; fix `renderer-labels.test.ts` (baseline decal).

---

## Zoom intermedio (overview → guida)

Data: 2026-09-21. Baseline: working tree post `df5be7b` (G2D-01). Result:
`docs/results/INTERMEDIATE-ZOOM-RESULT.md`.

- [x] ZI-01: `camera.ts` scala a 6 livelli (intermedio ×2.25 tra overview e guida), default 3, LOD 0-1 far / 2-3 medium / 4-5 near.
- [x] ZI-02: renderer/bootstrap + e2e (zoom, renderer-streaming, gta-city) e mock allineati; gate completa verde (440 unit, typecheck, build, 27 e2e + 1 canary skip).
- [x] ZI-03: result + README (zoom 6 livelli) + log esecuzione + CURRENT.md

---

## Nomi via leggibili (dentro la carreggiata)

Data: 2026-09-21. Baseline: working tree post ZI (non ancora commitato).
Result: `docs/results/LEGIBLE-ROAD-LABELS-RESULT.md`.

- [x] LB-01: `renderer.ts` helper puri `labelWorldHeightM` (42% carreggiata, clamp 1.2–4 m, place 3 m), `labelFitScale` (fit 80% lunghezza strada), `polylineLengthMeters` + unit test.
- [x] LB-02: `rebuildLabels` stile 128px bianco + contorno scuro, `text.scale` per label; `renderer-labels.test.ts` (scale atteso) + e2e `renderer-streaming` (scale in (0, 0.1)).
- [x] LB-03: gate completa (unit, typecheck, build, e2e) + docs (result, log esecuzione, CURRENT.md).

---

## Nomi via/luoghi duplicati (dedup per feature)

Data: 2026-09-21. Baseline: working tree post LB (non ancora commitato).
Result: `docs/results/NO-DUPLICATE-LABELS-RESULT.md`.

- [x] ND-01: `renderer.ts` helper puro `labelDedupKey` (strip suffissi per-chunk `:part:N` / `#pN`/`#hN`/`#aN`/`#wN`) + unit test.
- [x] ND-02: `rebuildLabels` dedup per chiave stabile, vince la copia più vicina alla camera; test unit (2 chunk stessa feature → 1 Text) + e2e `renderer-streaming`.
- [x] ND-03: gate completa + docs (result, log esecuzione, CURRENT.md).

---

## Un nome per via (dedup per nome normalizzato)

Data: 2026-09-21. Baseline: working tree post ND (non ancora commitato).
Result: `docs/results/ONE-NAME-PER-ROAD-RESULT.md`.

- [x] NN-01: `renderer.ts` helper puro `labelTextKey` (trim + collapse whitespace + casefold) + unit test; test RED dedup per nome (stesso nome feature distinte → 1, casing varianti → 1, nomi diversi → 2).
- [x] NN-02: `rebuildLabels` dedup per `labelTextKey(label.text)`, vince la più vicina alla camera; rimozione `labelDedupKey`; rovesciamento del test ND "feature distinte stesso nome → entrambi".
- [x] NN-03: gate completa (unit, typecheck, build, e2e, git diff --check) + docs (result, log esecuzione, CURRENT.md).
- [x] PN-01: `src/app/geocode.ts` client geocoding puro (Nominatim pinnato, errori tipizzati, validazione per-candidato, cache LRU, readBoundedJson) + `src/app/geocode.test.ts` (RED prima).
- [x] PN-02: `tests/e2e/place-search.spec.ts` RED (page.route Nominatim+tile: lista, selezione→lat/lon+tile centrale, 1 char→0 richieste, 429, timeout, offline).
- [x] PN-03: `live-controls.ts` campo "Cerca un luogo" (debounce, abort, listbox textContent, selezione tastiera/click, stato risolto, offline disabilitato) → e2e verde.
- [x] PN-04: gate completa + docs (SECURITY.md riga geocoding, result, log esecuzione, CURRENT.md).
- [x] WS-01: `VEHICLE_TUNING` top speed -20% (84→67.2, 14→11.2) + test controller aggiornati (RED prima).
- [x] WS-02: `compileRegion` emette collision shape per le water areas (line-only escluse) + test (RED prima).
- [x] ZP-01: `geocode.ts` `reverse()` (endpoint pinnato, `{error}` → undefined, stesso impianto errori) + unit (RED prima).
- [x] ZP-02: `src/app/place-status.ts` (zoneKeyForPose + createPlaceTracker: zona 1000 m, intervallo 5 s, 1 in-flight, retry pendente, errore silenzioso) + unit (RED prima).
- [x] ZP-03: `bootstrap.ts` wiring (ready → luogo, dispose) + e2e `place-status.spec.ts` (RED prima).
- [x] ZP-04: gate completa + docs (SECURITY.md, result, log, CURRENT.md).

---

## Location Visual Profiles (identità visiva locale)

Data: 2026-09-21. Baseline: `0433da1`. Spec:
`docs/specs/OPEN-GTA-LOCATION-VISUAL-PROFILES-V1.md`. ADR-014. Result:
`docs/results/LOCATION-VISUAL-PROFILES-V1-RESULT.md`.

- [x] LVP-00: ADR-014 + righe plan/todo/handoff.
- [x] LVP-01: `LocationContext` + reverse geocoding strutturato + `PlaceTracker.location()`.
- [x] LVP-02: contratto theme (types/hash/merge) + default profile = baseline corrente.
- [x] LVP-03: profili italy/rome/france/paris + resolver + override `?theme=`.
- [x] LVP-04: renderer theme injection (`setVisualProfile`, seed `featureId`, helper puri).
- [x] LVP-05: bootstrap auto-selection + debug + e2e.
- [x] LVP-06: validazione visiva Paris/Rome + result + gate completa.
- [x] LVP-07: raffino palette France/Paris dal gate visuale utente (tetti zincato con voci calde/fredde, facciate cream/limestone/taupe; Paris più fredda; screenshot prima/dopo + Rome invariato).
- [x] LVP-08 (LVP-2): profilo `tokyo` (spec §56) + resolver JP + registry estesa (6 id); 3 test RED→GREEN (36/36 unit) + e2e registry; gate a tre famiglie rome/paris/tokyo VALIDATO su geometria reale comune.
---

## Tile Budgets Live (città dense)

Data: 2026-09-21. Baseline: `cd59f65`. Result:
`docs/results/DENSE-TILE-BUDGETS-RESULT.md`.

- [x] TB-01: Misura tile z14 reali (Roma/Parigi/Lecce) → root cause "Risposta geografica troppo grande": budget decode feature/punti + `maxTileBytes` non propagato al decode.
- [x] TB-02: Opzioni provider `maxFeaturesPerTile`/`maxPointsPerGeometry` + config live 16 MiB/30k/100k; fixture Parigi z14 + 2 regression test; gate completa + verifica live reale su Parigi.

## Visual Profile Service (VPS)

Data: 2026-09-21. Spec:
`docs/specs/OPEN-GTA-VISUAL-PROFILE-SERVICE-V1.md`. ADR-015.

- [x] VPS-00: ADR-015 + righe plan/todo/handoff/SPEC.
- [x] VPS-01: tipi evidence (vocabolari chiusi, Distribution, VisualEvidenceProfile) + 3 fixture offline Rome/Paris/Tokyo-like (TDD).
- [x] VPS-02: VisualCatalog minimum semiato dai 6 profili LVP (TDD).
- [x] VPS-03: ProfileCompiler puro + test (determinismo, low-confidence→parent, completezza) + hook dev `?vps=` (TDD).
- [x] VPS-GATE: gate completa + screenshot 3 profili generati vs LVP su stessa geometria; result doc `docs/results/VISUAL-PROFILE-SERVICE-V1-RESULT.md` — **GO** (2026-09-21).
- [x] VPS-04: `cellForCoordinates` (h3-js res 9) + `EvidenceCache`/`ProfileCache` separate con chiavi spec §55 + test pipeline (TDD).
- [x] VPS-05: OSM evidence collector puro (mapping tag espliciti, confidenza classificati/osservati, densità, revisione deterministica) + 11 test end-to-end verso il compiler (TDD).
- [x] VPS-06: provider street-imagery (contratto neutro + selezione deterministica §14 + TestImageryProvider + MapillaryImageryProvider dietro client iniettato, errors tipizzati §80, nessuna credenziale nel core §82-83) + 23 test (TDD).
- [x] VPS-07: visual analyzer (contratto §18 + validatore stretto output modello §30/§78 + fallback unknown + TestVisualAnalyzer + fixture observations §115) + 19 test (TDD).
- [x] VPS-08: evidence aggregator (OSM+vision+detections → VisualEvidenceProfile, trust per asse §130, recency/spaziale §37-38, priorità fonte §40, revisione versionata) + 16 test (TDD).
- [x] VPS-09: end-to-end offline Rome/Paris/Tokyo (pipeline collect→analyze→aggregate→compile→cache→serve, fixture OSM per città, degrado provider failure, cache no-shadowing, 3 profili distinti) + 12 test (TDD).
- [x] VPS-10: runtime API `GET /v1/profile` (spec §106) — servizio Node TS nativo: client Overpass live + client Mapillary API correnti (`graph.mapillary.com`, Bearer, bbox — v1 REST non più esistente, recon 2026-09-22), cache file TTL §54 lvl 2-3 (sopravvive al restart), rate limit token bucket, fallback LVP immediato (cerchi città → THEME_BY_ID), 400/404/CORS, `.env.example` + `npm run service`, fix core `surface=sett`; 36 test offline (fake fetch) + 1 regressione + smoke live Roma (cobblestone 0.88 da OSM reale).
- [x] VPS-11: modello vision server-side — DeepSeek `deepseek-flash` dietro `VisualAnalyzer` (scelta host: nessuna GPU locale; costo ~$0.005/cella) + thumbnail in base64 (egress loro non raggiunge la CDN Mapillary) + thinking disabled + `VisionStats` §107 in response + `DEEPSEEK_API_KEY` opzionale; 21 test offline + smoke live Colosseo/Parigi (urbanCharacter historic-dense 0.927 da 11 foto reali, 2/13 fallback validatore).
- [x] VPS-12: coverage QA §108 — 6 celle live (centro/periferia/industriale/suburbano/scarsa imagery terra/mare) + matrice fallback (OSM down, imagery assente, vision down con chiave invalida, tutto assente) + finding copertura patchy a granularità cella + `VisionStats.errors`. Dettaglio in `docs/results/VISUAL-PROFILE-SERVICE-V1-RESULT.md` (sezione VPS-12).
- [x] VPS-GATE-V1: gate formale VPS v1 (spec §109) — 7 punti su 3 generazioni live (Roma/Parigi/Tokyo: città distinte 45-48/51 campi, >country theme 6-8 campi evidence-driven, determinismo 50/53 con caveat campionamento Mapillary, $0,0022-0,0034/cella, cache hit 1,5 ms, mai 5xx) + QA visuale §112 in e2e dedicato (rendering visibilmente guidato dal layer VPS: 9,1% e 12,9% vs soglie 4%/7%, rumore 0,00%) + campionatura statistica §110 (217 celle h3, raggio ~5 km: **68,7%** copertura, NO-GO non innescato) → **verdetto GO**. Dettaglio in `docs/results/VISUAL-PROFILE-SERVICE-V1-RESULT.md` (sezione VPS-GATE-V1).
- [ ] Gate VPS v1 (spec §109): validazione formale dei 7 punti (distinzione città, utile > country theme, determinismo, costi, cache, provider failure, coerenza stile) + QA visuale §112 in-browser.
- [ ] Aperto: ri-verifica classi detection Mapillary quando esce la doc ufficiale della nuova API.
