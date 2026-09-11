# DATA-10: Benchmark Overpass vs MVT

**Stato:** pianificato. **Dipendenze:** DATA-09. **Persona:** test-engineer. **Taglia:** M.

## Obiettivo
Stessa origine/rotta/viewport/griglia: time to first playable, bytes di
rete, numero richieste, p50/p95 latenza, decode/normalize/compile ms,
long frames, cache hits, failure/retry. Overpass misurato sulla fixture
(rete Overpass non raggiungibile da questo ambiente: dichiarato); MVT
misurato su fixture + una fetch reale (limite z14). Report con ambiente.

## READ
DATA-09, `tests/bench/`, `docs/testing/benchmark-protocol-v0.md`.

## MAY MODIFY / DO NOT TOUCH
Modificabili: benchmark e doc. Non cambiare il motore.

## TDD
1. RED: script benchmark che raccoglie le metriche su entrambe le source.
2. GREEN con esecuzione; report nel log con ambiente dichiarato.

## Accettazione
- [ ] AC1: metriche complete su entrambe le source.
- [ ] AC2: ambiente e limiti dichiarati (Overpass fixture-only, z14).
- [ ] AC3: nessuna modifica al motore; suite verde.

## Verifica
`npx vitest run --config vitest.bench.config.ts tests/bench/mvt-benchmark.test.ts` + gate comune.

## Handoff
DATA-11 usa i numeri per il gate del feature flag.
