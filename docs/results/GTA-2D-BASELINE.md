# GTA 2D — baseline del quartiere di riferimento (G2D-00)

Data: 2026-09-20. Baseline codice: `758255a`. Fixture:
`tests/fixtures/gta-city.ts`; spec: `tests/e2e/gta-city.spec.ts`.
Harness: `/tests/e2e/harness.html?fixture=gta-city` (verifica visiva
manuale o misure ripetibili). Piani: [G2D](../tasks/gta-2d/README.md),
[spec](../specs/gta-2d-city-v1.md), [analisi](../analysis/GTA-2D-VISUAL-GAP-2026-09-20.md).

## Scena

Quartiere sintetico su terreno `generic` (400 x 280 m, centro origine a (0,0),
x est / y nord). Tutte le misure in metri. Legenda:

```
y=160 ┌────────────────────────────────────────────────────────────┐
      │                                                  via-tee   │
      │                                   T(120,80)──────┬────────  │
 y=80 │                                                │via-tee-    │
      │           [vicolo N]────┐                      │stub       │
 y=60 │   via-alley ═══════════╪═══►  [bld-seam*]       │           │
      │           [vicolo S]────┘                      │           │
 y=15 │  ┌─[bld-concava]──┐        ┌[bld-bassa]┐       │           │
      │  └────────────────┘        └───────────┘   via-curva ╭──── │
 y=0  │ ════════════════════╪═════════════════════════════════╪═══ │
      │        via-nord     X(0,0)          [parco]            │   │
y=-30 │                    │                ┌──────┐      via-fork-  │
y=-40 │  ┌[bld-cortile]┐   │   ┌[bld-alta]┐ │      │      stem │   │
      │  └─────────────┘   │   └──────────┘ └──────┘          │   │
y=-60 │                    │                        Y(200,-60)┴───┤
      │                    │                       ╱    ╲          │
y=-100│ ═══════════════════╪═══════ via-fork-a ╱        ╲ via-fork-b
      │                    │                               (260,-100)
y=-120└────────────────────┴────────────────────────────────────────┘
      x=-120             x=0           x=60*            x=200
```

- Incrocio **X** a (0,0): Viale Centrale (E-W) x Corso Nord (N-S), residential 6 m.
- Incrocio **T** a (120,80): Via del Tee + stub verticale, residential 6 m.
- Bivio **Y** a (200,-60): due rami secondari 7 m che confluiscono in uno stelo.
- **Curva** a S (Via Curva, residential 6 m, 7 vertici) senza contatti.
- **Vicolo** (Via Vicolo Stretto, service 3.5 m) tra due palazzi
  (8 e 7 m di altezza), carreggiata compilata 3.2 m.
- Palazzi: basso 6 m e alto 24 m (rettangolari), concavo a L 12 m,
  cortile interno 15 m (foro con avvolgimento opposto), `bld-seam` 10 m
  che attraversa il solo confine di partizione x=60 (cella 60 m).
- Terreno: `generic` su tutta la scena + parco `Parco Verde` (label).

## Costanti fissate

| Elemento | Valore | Note |
| --- | --- | --- |
| Camera | posa (20, 10), heading 0, zoom level 2 | il renderer centra sulla posa; confronti ripetibili |
| Taxi | spawn fisico (-80, 0), heading 0 | sprite reale `taxi-gta1.png`, scala visiva 3.0 |
| Illuminazione | piatta | nessuna sorgente luminosa dinamica |
| Seed | `positionSeed` deterministico dei vertici interi | nessuna casualita' a runtime |
| Partizione | cella 60 m, chiavi x -2..4, y -2..2 (35 chunk) | variante chunk-boundary |

## Baseline registrata (2026-09-20, Chrome headless)

GPU: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) ...))` →
`software: true` (headless software, NON una GPU reale). Le misure su GPU
reale vanno ri-registrate su dispositivo dichiarato (G2D-17).

| Viewport | Scala px/m | Taxi misurato (L x W px) | Strada 6 m (px) | Camera bounds (m) | Compile | Render |
| --- | --- | --- | --- | --- | --- | --- |
| 640 x 480 | 1.333 | 15.5 x 7.2 | 8.0 | x -220..260, y -170..190 | 2.3 ms | 1.6 ms |
| 1280 x 800 | 2.222 | 25.8 x 12.0 | 13.3 | x -268..308, y -170..190 | 2.3 ms | 1.6 ms |
| 390 x 844 | 1.083 | 12.6 x 5.9 | 6.5 | x -160..200, y -379..399 | 2.3 ms | 1.6 ms |

Compilato: 7 palazzi, 9 strade, 2 aree terreno, 0 warning. Percorso
guidabile: fisica reale, 420 step a tutto gas da (-80,0) → `drivable: true`
(x > -30, |y| < 3).

Il taxi misura ~11.6 m visivi di lunghezza (5.4 m di larghezza esatti): lo
sprite conserva l'aspect ratio della texture (vincolo di larghezza). Il
bersaglio GTA 35-55 x 16-27 px a 640 x 480 e' oggetto di G2D-01, insieme
alla ricalibrazione del preset di guida: al default attuale l'inquadratura
a 640 x 480 copre ~360 m, ben oltre un incrocio leggibile.

## Limiti dichiarati

- Screenshot e misure della resa sono runtime (`test-results/`), fuori
  repository; la spec rigenera le immagini con camera e viewport fissi.
- Nessuna affermazione di prestazioni da questo ambiente software.
- La variante chunk-boundary e' verificata strutturalmente (2 frammenti
  per `bld-seam`, 2 per `via-tee`, 1 per `bld-bassa`); la resa dei seam
  arriva con G2D-13.

## G2D-01: proporzioni ricalibrate (confronto prima/dopo)

Preset di guida (livello 2): `ZOOM_STEPS` [0.7, 0.85, **6.0**, 12.0, 24.0]
(era [0.7, 0.85, 1.0, 4.0, 14.0]); `VEHICLE_VISUAL_SCALE` 1.2 (era 3.0,
intervallo spec 1.0-1.3). Il massimo zoom (livello 4) e' un target
separato dal preset di guida. Fix di correttezza emerso dalla
ricalibrazione: il rebuild del tier avveniva prima dell'aggiornamento di
`zoomLevel`, quindi il culling a far usava la scala del livello
precedente (la guard `renderer-streaming` lo ha catturato).

| Viewport | Scala px/m | Taxi misurato (L x W px) | Strada 6 m (px) | Camera bounds (m) |
| --- | --- | --- | --- | --- |
| 640 x 480 | 8.0 (era 1.33) | **37.1 x 17.3** (era 15.5 x 7.2) | 48 (era 8) | x -20..60, y -20..40 |
| 1280 x 800 | 13.3 | 61.8 x 28.8 | 80 | x -28..68, y -20..40 |
| 390 x 844 | 6.5 | 30.1 x 14.0 | 39 | x -10..50, y -55..75 |

Criteri spec verificati a 640 x 480: taxi 35-55 x 16-27 px, strada 6 m
con almeno due larghezze visive dell'auto (48 >= 34.6), >= 25 m di strada
davanti all'auto a ogni viewport. Guard mvt-live adeguata: guida alla
vista far per misurare la copertura dello streaming indipendentemente dal
preset di guida ricalibrato.
