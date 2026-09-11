# Architettura: camera zoom e LOD 2D

**Stato:** design per la tranche CITY (spec `docs/specs/city-drive-stable.md`,
ADR-010). **Baseline:** `77312aa`.

## Principi

1. Lo zoom e' una trasformazione camera/schermo: `1 metro canonico -> zoom ->
   N pixel`. Mai alterare geometria, collisioni o fisica.
2. Il mondo canonico non conosce zoom ne' LOD: i tier vivono nella
   presentazione (`src/render`), non in `src/world`/`src/geo`.
3. Il renderer deve diventare incrementale PRIMA del LOD: un cambio di tier
   su un renderer a rebuild completo costerebbe un intero ri-refresh.
4. Visibilita' e qualita' sono concetti separati: un chunk puo' essere
   visibile in FAR e non ancora disponibile in NEAR.

## Moduli

### src/app/camera.ts (nuovo, puro)

```ts
export type ZoomLevel = 0 | 1 | 2 | 3 | 4
export const ZOOM_STEPS = [0.70, 0.85, 1.0, 1.20, 1.45] as const
export type LodTier = "near" | "medium" | "far"
export function clampZoom(level: number): ZoomLevel
export function zoomFactor(level: ZoomLevel): number
export function lodForZoom(level: ZoomLevel): LodTier
export function cameraBounds(position, screenSize, scale): Bounds2D
```

Nessuna dipendenza da Pixi/Rapier/DOM: testabile con Vitest puro. I fattori
di `ZOOM_STEPS` sono sperimentali e vengono fissati dai benchmark di ZOOM-05.

### Renderer

- `viewScale() = baseScale * zoomFactor(zoomLevel)`, `baseScale` invariata
  (`max(1, min(w,h)) / 360`).
- Nuove API: `setZoom(level)`, `zoomIn()`, `zoomOut()`, `cameraState()`.
- `cameraBounds()` continua a derivare da `viewScale()`: la domanda di
  streaming reagisce senza contratti nuovi.
- `updateCamera` resta centrata sul veicolo a ogni zoom.

### Renderer incrementale (SOLID-04)

```ts
interface ChunkPresentation {
  root: Container
  layers: { ground; roads; buildings; labels }  // per-chunk
}
const renderedChunks = new Map<ChunkId, ChunkPresentation>()
setChunk(chunk)     // costruisci solo la presentazione del chunk
updateChunk(chunk)  // sostituzione contenuto dello stesso id
removeChunk(id)     // distruggi solo le risorse del chunk
```

Ordine globale dei layer preservato con un container per tipo di layer
(ground < roads < buildings < labels) che ospita i gruppi per chunk; maschere
e z-order globali restano invariati. Il vecchio `render(list)` resta come
entry point di compatibilita' per il V0 offline e come rebuild completo per
casi rari (es. cambio set totale), con short-circuit su identita' gia'
esistente.

### Sessione e streaming (ZOOM-04)

- La sessione mantiene `zoomLevel` e lo passa al renderer; la firma di
  stream include gia' `cameraBounds` (che cambia con lo zoom), quindi il
  debounce a 200 ms e la deduplica coprono anche le raffiche di zoom.
- La guardia di disponibilita' (`isPoseAvailable` con le chiavi APPLICATE)
  NON cambia: zoom out mostra territorio ma non lo rende percorribile.
- `snapshot()` espone `zoomLevel` e `lodTier` per l'overlay.

### LOD (Fase C)

`lodForZoom` mappa i livelli: 0-1 -> far, 2 -> medium, 3-4 -> near
(mapping iniziale sperimentale). La presentazione applica:

- facade: forza moltiplicativa per tier (0 / 0.25 / 0.6 / 0.85 / 1);
- road detail: FAR body strada; MEDIUM casing; NEAR marking;
- labels: soglia per importanza al tier;
- culling: feature con footprint < soglia px² al tier corrente, skip
  visuale soltanto.

Tutti i valori sono parametri di presentazione centralizzati in un profilo
per tier, non logica sparsa.

## Debug overlay esteso

Aggiungere ai campi esistenti: `zoom`, `lod`, `camera: WxH m`, `visible
chunks`, `normalize ms`, `compile ms`, `renderer apply ms`. I campi
"warnings"/"compile" gia' presenti diventano reali con SOLID-01.

## Sequenza di costruzione

SOLID-01..05 (metriche, cancellazione, benchmark, renderer incrementale,
long-drive) -> ZOOM-01..05 -> LOD-01..05 -> CACHE-01..04 -> CITY-01/02
(canary e gate). Ogni slice e' indipendente e ri-verificabile col gate
comune (typecheck, test:run, test:e2e, build, smoke dist).
