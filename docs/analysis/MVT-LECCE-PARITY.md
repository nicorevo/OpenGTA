# MVT Parity Lecce — Overpass vs OpenFreeMap z14

Generated: 2026-09-11T20:03:32.286Z. Decisione: vedi sezione dedicata.

## Ambiente

- **date**: 2026-09-11T20:03:32.286Z
- **node**: v26.4.0
- **os**: Linux 7.2.4-200.fc44.x86_64
- **cpu**: Intel(R) Core(TM) Ultra 7 258V
- **ramMiB**: 33150
- **commit**: 52ff642
- **overpassFixture**: lecce-sant-oronzo-v0.raw.json (300 m box, network unreachable from this environment)
- **mvtFixture**: lecce-z14-openfreemap.pbf (tile 14/9019/6181, public z14 ceiling)

## Matrice di parity (stessa origine Sant'Oronzo, stesso box V0 ±300 m)

| Metrica | Overpass (fixture 300 m) | OpenFreeMap z14 |
| --- | --- | --- |
| Elementi grezzi / feature decodificate | 7414 | 4623 |
| Bytes fixture | 839963 | 321055 |
| Roads nel box V0 (±300 m) | 389 | 87 |
| Roads raw (tile intero) | n/d (box 300 m) | 833 |
| Buildings nel box V0 | 164 | 138 |
| Buildings raw (tile intero) | n/d | 3124 |
| Land nel box V0 | 24 | 10 |
| Water nel box V0 | 0 | 0 |
| Barriers (gap dichiarato) | 33 | 0 (gap dichiarato) |
| Trees (gap dichiarato) | 11 | 0 (gap dichiarato) |
| Warning normalizzazione | 0 | 29 |
| Roads compilati | 389 | 87 |
| Buildings compilati | 164 | 138 |
| Ground compilati | 24 | 10 |
| Collisioni | 241 | 138 |
| Label | 248 | 0 |
| Decode/normalize ms | 18.4 | 20.8 + 32.0 (decode+map) |
| Compile ms | 32.1 | 9.0 |
| Area km² | 0.2827 | 3.4706 |
| Densità roads/km² | 1375.8 | 307.7 |
| Densità buildings/km² | 580.0 | 488.1 |
| Densità collisioni/km² | 852.4 | 488.1 |

## Classi stradali nel box V0

Overpass:
  - path: 188
  - pedestrian: 60
  - residential: 122
  - service: 4
  - tertiary: 13
  - unknown: 2

OpenFreeMap:
  - residential: 70
  - service: 4
  - tertiary: 13

## Gap dichiarati

- OpenFreeMap z14 non espone barriere utilizzabili dal modello OpenGTA
  (layer barrier assente nel profilo pubblico): collisioni da barrier = 0.
- Alberi/punti notevoli non mappati nel PoC: trees = 0.
- Overpass misurato solo su fixture: la rete Overpass non è raggiungibile
  da questo ambiente (verificato in DATA-01).
- OpenFreeMap pubblico ha soffitto z14: z15/z16 restituiscono tile vuote.

## Decisione

**GO VISUAL ONLY** per la source pubblica OpenFreeMap z14.

Motivazione, sui numeri della matrice (stesso box V0 ±300 m, stessa origine):

- La pipeline MVT è completa e deterministica end-to-end (decode → mapping →
  clip → compileRegion): nessun crash, 29 warning di sola classificazione non
  mappata, conteggi identici su run ripetute. **Non è NO-GO.**
- Il confronto crudo roads 389 vs 87 va letto con le classi: la baseline
  Overpass include 248 path/pedestrian non carrabili, esclusi dal mapping MVT
  per design. Carrabili: **141 vs 87 (62%)**; residential 122 vs 70 (57%) —
  a z14 alcune strade minori del centro mancano.
- Il layer visuale regge: **buildings 164 vs 138 (84%)**, land 24 vs 10,
  water assente in entrambi nel box. Densità buildings 580 vs 488/km².
- Costi crollano: **~32× meno byte/km²** (839.963 B su 0,28 km² vs 321.055 B
  su 3,47 km²) e **~4× meno ms/km²** (normalize 18,4 ms vs decode+map
  52,8 ms per l'intera tile).
- Il gameplay NON è pronto con z14 pubblico: collisioni 241 vs 138 (**57%**,
  densità 852 vs 488/km²), barriere 33 vs 0 e alberi 11 vs 0 (gap dichiarati),
  label 248 vs 0 (layer poi non mappato nel PoC). La guida funzionerebbe su
  strade principali, ma con collisioni incomplete e rete minore bucata.
- Percorso di upgrade dichiarato: un dataset self-hosted/PMTiles a z16
  (DATA-15..18) riporterebbe minor roads, barriere e poi senza toccare
  canonical/compiler; questa matrice resta la baseline di confronto.

Conseguenza operativa: il feature flag DATA-11 parte come
`provider=openfreemap-mvt` sperimentale, mai default; la decisione GO per il
gameplay è demandata a una parity futura su dataset a zoom superiore.
