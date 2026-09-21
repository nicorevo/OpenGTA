# OpenGTA — Dense tile budgets (live MVT) — result

**Data:** 2026-09-21
**Baseline:** `cd59f65` (LVP v1)
**Stato:** completato

Niente spec nuova: fix della configurazione live della tranche
Provider-Neutral World Streaming + regression test per l'errore
"Risposta geografica troppo grande" (`response-too-large`) visto guidando in
città dense.

## Problema

In modalità live (provider MVT OpenFreeMap pinnato), guidando su aree dense
(baricentro Parigi), la barra di stato mostrava "Risposta geografica troppo
grande" e il settore restava non disponibile.

## Root cause

Misurazione dei tile z14 reali (dataset pinnato `20260830_080001_pt`) decodati
con i limiti di default del provider:

| Tile (z14) | Bytes | Feature | Max punti/geometria |
| --- | --- | --- | --- |
| Roma centro (8759/6088) | 0.78 MiB | 8,932 | 35,537 |
| **Parigi centro (8299/5636)** | 1.05 MiB | **16,952** | **52,043** |
| Lecce (9018/6181) | 0.25 MiB | 3,449 | 35,046 |

Due cause, entrambe mappate su `response-too-large`:

1. **Budget di decode troppo bassi per città dense**:
   `DEFAULT_MAX_FEATURES_PER_TILE = 10,000` (Parigi: 16,952) e
   `DEFAULT_MAX_POINTS_PER_GEOMETRY = 50,000` (Parigi: 52,043). Il budget byte
   NON era la causa (tile < 1.1 MiB).
2. **Bug latente**: `createOpenFreeMapProvider` applicava `maxTileBytes`
   (16 MiB, configurato nel bootstrap) solo allo stream di fetch, poi
   decodificava con `decodeVectorTile(bytes)` senza opzioni → il decodificatore
   applicava sempre i suoi default (byte 8 MiB, feature 10k, punti 50k). Un
   tile tra 8 e 16 MiB avrebbe comunque fallito in decode.

## Cosa è cambiato

- `VectorTileProviderOptions` (`src/world/runtime/vector-tile/provider.ts`):
  nuove opzioni `maxFeaturesPerTile` e `maxPointsPerGeometry` (stessa
  validazione `RangeError` di `maxTileBytes`); il provider passa ora i tre
  budget al decodificatore — un'unica sorgente di verità tra fetch e decode.
- Config live (`src/app/bootstrap.ts`): `maxTileBytes: 16 MiB` (ora
  effettivamente applicato anche in decode), `maxFeaturesPerTile: 30,000`
  (~3× il picco misurato), `maxPointsPerGeometry: 100,000` (2× il default
  precedente, ~2× il picco misurato). I default di sicurezza del
  decodificatore restano invariati (8 MiB / 10k / 50k / 256 / 64).
- Fixture `src/fixtures/geo/paris-center-z14-8299-5636.pbf` (tile pinnato
  reale, 1.05 MiB, fetched 2026-09-21 da
  `https://tiles.openfreemap.org/planet/20260830_080001_pt/14/8299/5636.pbf`)
  + 2 test in `provider.test.ts`: con i budget default il tile denso è
  respinto (`response-too-large`, boundary di sicurezza preservato); con i
  budget live si decodifica con `featureCount = 16,952`.

## Verifica

- TDD: RED (il test "decodes dense real tiles with the live budgets" falliva
  senza l'opzione) → GREEN.
- Gate: `npm run test:run` **550/550** (64 file); `npm run typecheck` pulito;
  `npm run build` verde; `npm run test:e2e` **42 passed + 1 canary skipped,
  0 failed**; `git diff --check` pulito.
- Verifica live reale (endpoint OpenFreeMap senza mock):
  `?mode=open-world-live&lat=48.8566&lon=2.3522` (Parigi centro, lo scenario
  che falliva) → `state=ready`, 363 edifici / 82 strade,
  `runtime.errors = {}`, zero pageerror, screenshot `/tmp/opengta-live-paris.png`.

## Limiti

- La via Overpass/OSM JSON (`provider=osm|http`) mantiene il budget
  `DEFAULT_RESPONSE_BYTES = 8 MiB`: non è la modalità di default e non era la
  causa del report; si alza solo se osservato.
- 30k/100k sono dimensionati sui picchi misurati (città europee dense); se
  altre regioni mostrassero `response-too-large` in pratica, si ritocca la
  config live nel bootstrap, non i default del decodificatore.
