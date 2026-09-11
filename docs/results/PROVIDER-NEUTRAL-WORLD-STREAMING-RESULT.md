# Risultato: Provider-Neutral World Streaming (migrazione a Vector Tiles)

Data: 2026-09-11. Stato: consegnato.
Baseline: `f7d5fff` sul ramo `opcl` (checkpoint D-A/D-B/D-C chiusi).
Piano: `tasks/plan.md`. Checklist: `tasks/todo.md`.
Spec: `docs/specs/provider-neutral-world-streaming.md`.
ADR: `docs/adr/ADR-011-mvt-provider-neutral-source.md`.
Riferimento: `docs/OpenGTA-DATA-SOURCE-MIGRATION.md`.

## Esito

DATA-00..14 completati; checkpoint D-A/D-B/D-C superati. Il client ora ha
due sorgenti dietro un unico contratto (`CanonicalRegionSource` →
`WorldRegion` → `compileRegion` unico): Overpass (reference/fallback,
percorso legacy invariato) e OpenFreeMap vector tiles (`provider=
openfreemap-mvt`, sperimentale, mai default). La rete Overpass è
irraggiungibile da questo ambiente (diagnosticato in DATA-01); la parity
Lecce su fixture ha deciso **GO VISUAL ONLY** per la source pubblica z14.
DATA-15..18 restano righe di piano da dettagliare.

## Vincoli del documento di migrazione -> evidenza

| Vincolo | Evidenza |
| --- | --- |
| Nessun token/chiave nel client o nei log | Nessuna credenziale introdotta; l'endpoint MVT è una costante pinnata (`OPENFREEMAP_TILE_BASE_URL`), mai input utente |
| Mai bypassare 429/Retry-After | Invariato: Overpass non fallisce mai su 429; il provider tile espone `retryAfterMs` e il runtime non ritenta |
| Nessuna rotazione aggressiva di mirror | Un solo fallback dev (mail.ru) su errori di rete/5xx persistenti; mai parallelo |
| Nessuna query parallela a più provider | Il benchmark fa una fetch reale sequenziale; il runtime risolve i tile per chunk in sequenza |
| Mai fingere RawOsm da MVT | Il percorso MVT produce `WorldRegion` direttamente (`normalizeMvtTiles`); il placeholder GeoDataSource è stato rimosso in DATA-14 |
| Overpass resta reference/debug/fallback | Default invariato (`provider=osm`); il percorso legacy è intatto e coperto da test |
| Attribuzione OSM sempre visibile | Barra "OpenStreetMap contributors" invariata in tutte le modalità |
| Input tile bounded/validato | Decoder con limiti (byte/feature/punti), `response-too-large`, chiavi tile validate, timeout con AbortSignal |
| Policy endpoint di produzione invariata | `live-config.ts`: la policy https non cambia; il provider MVT ignora il parametro endpoint (test dedicato) |

## Matrice di parity e decisione

Report: `docs/analysis/MVT-LECCE-PARITY.md` (stessa origine Sant'Oronzo,
finestra MVT = box V0 ∩ area propria del tile 9019, 0,2413 km²).

| Metrica | Overpass (fixture 300 m) | OpenFreeMap z14 |
| --- | --- | --- |
| Roads carrabili nel box | 141 | 75 (53%) |
| Buildings | 164 | 127 (77%) |
| Collisioni | 241 | 127 (53%) |
| Barriere / alberi / label | 33 / 11 / 248 | 0 / 0 / 0 (gap dichiarati) |
| Byte / km² (scala tile) | ~2,97 MB su 0,28 km² | ~92 KB su 3,47 km² (~32× meno) |

Decisione: **GO VISUAL ONLY** — pipeline completa, deterministica e più
economica; gameplay non pronto con z14 pubblico (rete minore bucata,
collisioni al 53%, niente barriere/alberi/label). Non NO-GO: il percorso
funziona e l'upgrade z16/PMTiles (DATA-15..18) non tocca
canonical/compiler.

## Misure

Benchmark: `docs/analysis/MVT-BENCHMARK.md` (protocollo V0, ambiente
dichiarato: headless, GPU unknown, Node v26.4.0, N=7).

- First playable (source→chunk compilato): Overpass 50,1 ms vs MVT
  47,5 ms — MVT processando l'intera tile (4623 feature, 3,47 km²).
- Fetch reale OpenFreeMap: HTTP 200, 514,4 ms, 321.055 B, contenuto
  byte-identico alla fixture (dataset pinnato `20260830_080001_pt`).
- Nessuno stall >100 ms; p95 delle fasi sotto le soglie di alert V0.
- E2E MVT (tile intercettate): first playable + guida di 600 m con 13
  chunk distinti attivati, 32,7 s.

## Verifica finale

322 test unitari, 10 test bench, 22 E2E su dev server (più 1 skip canary
live), 1 smoke del build di produzione, typecheck, build, `git diff --check`.

## Limiti noti dichiarati

- OpenFreeMap pubblico ha soffitto z14 (z15/z16 vuote); il flag MVT è
  sperimentale e mai default.
- La parity MVT non include la striscia ovest del box (tile 9018 non
  nella fixture) e l'Overpass è misurato solo su fixture (rete
  irraggiungibile da questo ambiente).
- Cache/retry/failure del percorso tile sono misurati fino al livello
  runtime (degraded, non crash); il tile cache persistente è materia di
  DATA-17 (deferred).
