# Checklist: Provider-Neutral World Streaming

Data: 2026-09-11.
Stato: pianificato; nessun task avviato.

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

- [x] [FP-01](tasks/first-person/FP-01.md): camera 3D config (FOV, height, projection matrix)
- [x] [FP-02](tasks/first-person/FP-02.md): road segment projector (centerline → screen segments)
- [x] [FP-03](tasks/first-person/FP-03.md): road segment drawer (back-to-front poligoni)

### Phase 2: Environment

- [x] [FP-04](tasks/first-person/FP-04.md): building side projection (edifici laterali)
- [x] [FP-05](tasks/first-person/FP-05.md): sky gradient (orizzonte)

### Phase 3: Integration

- [x] [FP-06](tasks/first-person/FP-06.md): first-person renderer orchestration
- [x] [FP-07](tasks/first-person/FP-07.md): V key toggle (interfaccia PixiRenderer)

### Phase 3.5: Fix vista FPV (regressione)

- [x] [FP-08](tasks/first-person/FP-08.md): fix orientamento camera (90°) + layering ground/road + facciate edifici (MVP, guard e2e)

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
