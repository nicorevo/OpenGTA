# Checklist: GTA 2D (citta' dall'alto, strade e palazzi)

Data: 2026-09-20. Stato: G2D-00 consegnato; G2D-01..18 da fare.

Fonte: [piano](plan.md). Prima di eseguire leggere
[istruzioni e contratti comuni](gta-2d/README.md).

## Gate A: proporzioni e proiezione

- [x] [G2D-00](gta-2d/G2D-00.md): quartiere di riferimento ripetibile.
- [ ] [G2D-01](gta-2d/G2D-01.md): proporzioni taxi, strada e camera.
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
