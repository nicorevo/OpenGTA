# Benchmark Overpass vs OpenFreeMap z14

Generated: 2026-09-11T20:55:16.660Z. Protocollo: docs/testing/benchmark-protocol-v0.md.
Stessa origine Sant'Oronzo, stesso box V0 ±300 m, stesso codice di misura.

## Ambiente

- **date**: 2026-09-11T20:55:16.660Z
- **node**: v26.4.0
- **os**: Linux 7.2.4-200.fc44.x86_64
- **cpu**: Intel(R) Core(TM) Ultra 7 258V
- **gpu**: unknown (benchmark headless, nessuna API browser)
- **ramMiB**: 33150
- **browser/renderer**: N/A (benchmark headless senza canvas; fasi renderer/fisica misurate in E2E)
- **commit**: c409952
- **heapUsedMiB**: 16.61

## Fasi cold-start (fixture, N=7)

### Overpass (fixture 300 m, rete irraggiungibile)

| Fase | p50 ms | p95 ms | p99 ms | max ms | stall >100 ms |
| --- | --- | --- | --- | --- | --- |
| acquire (read fixture) | 3.5 | 4.5 | 4.5 | 4.5 | 0 |
| normalize | 7.9 | 33.3 | 33.3 | 33.3 | 0 |
| compile | 18.5 | 35.6 | 35.6 | 35.6 | 0 |
| totale first playable (source→chunk compilato) | 30.4 | 73.4 | 73.4 | 73.4 | 0 |

- first playable misurato (prima iterazione): 73.4 ms
- iterazioni: 7; richieste reali: 0; byte rete: 0
- byte fixture: 839963; elementi/feature in ingresso: 7414
- feature canoniche (box V0): 621; chunk compilati: 1
- cache hits: 0 — Nessun layer di cache nel percorso di benchmark; il persistent store runtime non è coinvolto. DATA-11 introduce il tile cache e rimisura.
- failure/retry: 0 richieste reali: tutti gli host Overpass sono irraggiungibili da questo ambiente (verificato in DATA-01). Percorsi retry/429 non esercitati su fixture.

### OpenFreeMap z14 (fixture tile 14/9019/6181)

| Fase | p50 ms | p95 ms | p99 ms | max ms | stall >100 ms |
| --- | --- | --- | --- | --- | --- |
| acquire (decode PBF) | 8.2 | 16.1 | 16.1 | 16.1 | 0 |
| mapping+clip | 15.3 | 22.6 | 22.6 | 22.6 | 0 |
| compile | 4.4 | 6.7 | 6.7 | 6.7 | 0 |
| totale first playable (source→chunk compilato) | 30.1 | 45.4 | 45.4 | 45.4 | 0 |

- first playable misurato (prima iterazione): 45.4 ms
- iterazioni: 7; richieste reali: 1; byte rete: 321055
- byte fixture: 321055; elementi/feature in ingresso: 4623
- feature canoniche (box V0): 212; chunk compilati: 1
- cache hits: 0 — Nessun layer di cache nel percorso di benchmark; DATA-11 introduce il tile cache e rimisura.
- failure/retry: 1 fetch reale sequenziale (mai parallelo, mai rotazione): risultato registrato sotto. Retry/429 non esercitati: nessun bypass di Retry-After.

## Fetch reale OpenFreeMap (1 richiesta sequenziale, tile pinnata)

- esito: OK — HTTP 200
- latenza: 778.9 ms; byte: 321055
- contenuto identico alla fixture: sì

## Envelope V0 (alert ingegneristici, non SLA)

- p95 fase > 20 ms / p99 > 33,3 ms / stall singolo > 100 ms: segnalati
  nelle tabelle sopra; nessuna soglia è assertita dal benchmark.

## Confronto dichiarato

- Overpass: fixture-only. La rete Overpass non è raggiungibile da questo
  ambiente (tutti gli host verificati in DATA-01); latenze di rete Overpass
  non misurabili qui e non inventate.
- MVT: fixture + una fetch reale sequenziale al soffitto pubblico z14.
- Cache, retry e failure: non esercitati nel percorso di benchmark (note
  per-source sopra); il tile cache arriva con DATA-11.
