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

- [ ] [FP-08](tasks/first-person/FP-08.md): fix orientamento camera (90°) + layering ground/road + facciate edifici

---

## Code Review Remediation (RV)

Data: 2026-09-17. Fonte: review complessiva (baseline `ae92e10`).
Prima di eseguire leggere [contratti e procedura](review/README.md).

### P0 — da risolvere prima del merge

- [x] [RV-01](review/RV-01.md): cancel stream MVT sul budget.
- [x] [RV-03](review/RV-03.md): test bench nel gate standard.
- [x] [RV-02](review/RV-02.md): re-sync SECURITY.md.
- [x] [RV-05](review/RV-05.md): label O(1) + destroy.
- [ ] [RV-04](review/RV-04.md): cache tile + concorrenza bounded + retry.
- [ ] R-A: P0 (cancellazione, cache, retry, label, docs, gate).

### P1 — robustness e performance

- [ ] [RV-10](review/RV-10.md): validazione codec deser.
- [ ] [RV-09](review/RV-09.md): pre-filtro bbox relazioni OSM.
- [ ] [RV-08](review/RV-08.md): write IndexedDB serializzate + indice.
- [ ] [RV-06](review/RV-06.md): stop app Pixi inattiva al toggle.
- [ ] [RV-07](review/RV-07.md): pre-cull strade FP.
- [ ] R-B: robustness e performance.

### P2 — pulizia

- [ ] [RV-11](review/RV-11.md): rimozione dead code.
- [ ] [RV-12](review/RV-12.md): batch nits.
- [ ] R-C: pulizia + gate finale.
