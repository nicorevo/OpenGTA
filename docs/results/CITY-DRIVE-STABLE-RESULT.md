# Risultato: City Drive Stable (solidità, zoom e LOD)

Data: 2026-09-11. Stato: consegnato.
Baseline di partenza: `77312aa`. Commit finale della tranche: vedi log
CITY-02. Piano: `tasks/plan.md`. Checklist: `tasks/todo.md`.
Spec: `docs/specs/city-drive-stable.md`. ADR: ADR-010.

## Esito

Tranche CITY completata: SOLID-01..06, ZOOM-01..05, LOD-01..05, CACHE-01..04,
CITY-01..02. Checkpoint C-A..C-E superati. L'utente puo' scegliere una zona
(Lecce per prima), partire rapidamente, guidare per 100+ finestre senza
perdite, usare lo zoom `+/−` a 5 livelli con LOD near/medium/far, ricaricare
la pagina riusando i chunk compilati dalla cache persistente, e continuare a
giocare durante errori recuperabili.

## Matrice requisiti → prove

| Requisito (spec) | Prova |
| --- | --- |
| F-NAV-1 avvio progressivo | Invariato dalla tranche ONLINE (E2E live-startup, misure firstPlayable ~110 ms vs ultimo chunk ~14 s) |
| F-NAV-2 100+ finestre | SOLID-05: test long-drive 20 cicli, generation > 100, asserzioni per-step su record/cache/pending/stato |
| F-NAV-3 rilascio risorse | SOLID-04/05: renderer incrementale (rimozione distrugge solo il chunk), collider/record bounded, dispose pulito |
| F-NAV-4 ritorno senza refetch | CACHE-01..04: reload con ZERO richieste provider (E2E persistent-cache) |
| F-ZOOM-1 5 livelli | ZOOM-01/02: modulo camera puro, clamp 0..4, fattori sperimentali benchmarkati (ZOOM-05) |
| F-ZOOM-2 controlli accessibili | ZOOM-03: E2E zoom.spec (limiti disabilitati, scorciatoie, guida dopo click, responsive) |
| F-ZOOM-3 presentazione only | ZOOM-02: test harness (centro e fisica invariati); nessun modulo fisico toccato |
| F-ZOOM-4 domanda reagisce, no tempeste | ZOOM-04: wanted set per zoom nel debounce 200 ms; limiti coda invariati |
| F-ZOOM-5 guardia sui chunk applicati | Invariata (test ONLINE-11 + long-drive per-step) |
| F-LOD-1 politica pura | LOD-01: lodForZoom totale e deterministico, profilo congelato |
| F-LOD-2 tier per dettaglio | LOD-02..05: harness E2E con diagnostica (labels 1/1/2, facades 1/0/1, casing true/false/true, culled 0/1/0) |
| F-LOD-3 culling solo visuale | LOD-05: collider/world model intatti (nessun modulo fisico/compiler toccato) |
| F-ERR-1 errori non bloccanti | Regressioni ONLINE-10..15 verdi (Riprova/Interrompi/revoca) |
| F-ERR-2 compile cancellabile | SOLID-02/03: abort nei loop caldi; benchmark abort-stop ~1 ms |
| N-PERF-1 metriche reali | SOLID-01: fasi acquire/decode/normalize/compile/total misurate; overlay reale |
| N-PERF-2 renderer incrementale | SOLID-04: E2E incrementale (chunk invariato = zero churn, crescita per delta) |
| N-PERF-3 benchmark patologici | SOLID-03: 20k membri 1220 → 63 ms con budget 500 ms dichiarato |
| N-MEM-1 budget memoria | SOLID-05: record <= 12, cache <= 9, collider <= 20, pending <= 32 a ogni passo |
| N-SEC-1 SECURITY riallineato | SOLID-06: threat model reale + gate di consistenza documentale |
| N-TEST-1 canary separata | CITY-01: OPENGTA_CANARY=1, report sempre scritto, mai in CI |
| N-TEST-2 long-drive a clock simulato | SOLID-05: ~2 s, zero rete |

## Misure chiave

- Multipolygon patologico 20k membri: normalize 1.220,7 → 62,8 ms
  (indicizzazione per endpoint + catene a due stack); abort-stop ~1 ms.
- Cache persistente: write mediana 5,5-6,4 ms, read 3,3-4,3 ms,
  deserializzazione 3,9-5,3 ms vs compile 98,5-102,5 ms → adottata.
- Reload con cache persistente: 0 richieste provider dopo il primo
  caricamento (8 richieste).
- Zoom demand (1280x720 headless): livello 0 = 914x514 m/8 celle,
  livello 4 = 441x248 m/4 celle; LOD per tier riduce il costo visuale.
- E2E misurazioni cold/warm: firstPlayable ~110 ms, warm ~1 ms.

## Canary

Eseguita su Lecce il 2026-09-11: provider Overpass non raggiungibile
dall'ambiente di questa macchina (errori "network" su tutte le celle; anche
`curl` = 000). La suite ha rilevato e registrato il guasto come previsto;
esito separato dalla CI. Da rieseguire su ambiente con rete
(`npm run test:canary`).

## Limiti dichiarati

- Il raggruppamento stradale per larghezza e il painter degli edifici sono
  esatti DENTRO ogni chunk; fra chunk l'ordinamento e' approssimato dagli
  zIndex (nessuna discontinuita' per frammenti della stessa strada).
- I fattori di zoom restano sperimentali: la calibrazione finale richiede
  benchmark su hardware reale (profili DESKTOP_LOW/MID) — CITY-02 non
  promette esperienza su hardware altrui.
- Il canary non e' verde in questo ambiente per rete assente; non e' un
  difetto del client.
- Worker, wheel/pinch continui, traffico, pedoni e produzione restano nei
  filoni differiti con le condizioni di apertura.

## Verifiche finali

- `npm run typecheck`: PASS.
- `npm run test:run`: PASS — 34 file, 241 test.
- `npm run build`: PASS (warning dimensione bundle preesistente).
- `OPENGTA_E2E_PORT=5175 npm run test:e2e`: 21 PASS, 1 skipped (canary).
- Smoke dist: PASS.
- Benchmark (`vitest.bench.config.ts`): PASS.
- `git diff --check` pulito; lint N/A; nessun artefatto runtime committato.
