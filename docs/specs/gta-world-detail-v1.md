# Spec: Dettaglio mondo GTA — ri-renderizzare le classi già presenti nel chunk

> Define-first, in chiave **preset GTA** (niente ricolor "Google Maps").
> Baseline: working tree post `568dcc0` (+ close-zoom uncommitted). Stack: TS strict,
> Vite, PixiJS v8 (vettoriale), Rapier, Vitest, Playwright.

## 1. Problema

Il chunk compilato porta già, per ogni elemento, una **chiave di stile per classe**
(`styleKey = <kind>:<class>`), ma il renderer oggi la usa quasi per nulla:

- **Terreno**: 1 solo colore (park vs "altro" vs acqua) — ignora le ~12 `landClass`.
- **Strada**: 1 solo asfalto scuro — ignora le `roadClass` (motorway…service).
- **Edificio**: 2 colori (historic vs default) — ignora le `buildingType`.

Dati che invece **scartiamo nel compilato** (`trees`, `sourceLevels`, `laneCount`,
`materialHint`, `roofTypeHint`): fuori scope qui (richiedono cambio schema codec;
`materialHint`/`roofTypeHint` non sono popolati da nessuna fonte; `trees` solo OSM).
→ Follow-up separato.

### Vincolo dati live (verificato)
Il provider **live (MVT/OpenFreeMap z14)** varia `roadClass` e `landClass`, ma
`buildingType` è sempre `"unknown"` e `trees` è vuoto (`mvt-buildings.ts:28`,
`mvt.ts:171`). La fonte **Overpass/OSM** popola tutto (type, trees, lanes, levels).

## 2. Obiettivo

Ri-renderizzare le classi già nel chunk **in stile GTA** (variété mute, terrose),
senza nuovi dati e senza nuovo schema. Deve essere un **miglioramento stretto**:
dove il dato esiste c'è varietà; dove no (MVT buildingType="unknown") resta un
default sensato + varietà deterministica.

## 3. Cosa si fa (render-side, pure helper in `renderer.ts`)

Nuovi helper puri (testabili), in stile dei helper geometrici esistenti:

- `groundFill(kind: "water"|"land", cls: string): number`
  → colore terreno per `landClass` (GTA: prati/parchi verdi vari, foresta verde scuro,
    parking grigio, sabbia, terra nuda, industriale grigio-cemento, generic spento) e per
    `water` (acqua: tono per `waterClass`, default azzurro).
- `roadStyle(cls: string): { fill: number; casing: number }`
  → asfalto scuro di base; arterie (motorway/trunk/primary) tono/emfasi più marcati,
    secondarie/residenziali più sobri. Larghezza resta `widthMeters`.
- `buildingStyle(cls: string, seed: number): { roof: number; facade: number }`
  → tetto/facciata da una palette GTA mute (terracotta, grigi, mattone, sabbia, ardesia).
    Se `cls` è un tipo "caratteristico" (historic, civic, religious, industrial) → colore
    caratteristico; altrimenti **variabilità deterministica da `seed`**.
- `positionSeed(x: number, y: number): number`
  → FNV-1a della posizione mondiale quantizzata (round) del baricentro edificio.
    **Indipendente dal tile** → stesso edificio = stesso colore su tutti i chunk
    (niente cuciture visibili tra tile).

### Wiring nel renderer
- Loop terreno: `groundFill(piece.kind, classeDaStyleKey(piece))` al posto dei 3 colori.
- Strade: `roadStyle(cls)` per `roadCasing`/`roadSurface` (al posto di ROAD_EDGE/ROAD_FILL).
- Edifici: `buildingStyle(cls, positionSeed(cx, cy))` per tetto + facciata (al posto dei 2 colori).

`preservation`: nessun nuovo layer, nessun nuovo campo nel chunk, nessun cambio LOD.

## 4. Cosa NON si fa (out of scope)

- Ricolor "Google Maps light" (l'utente vuole il preset GTA).
- Nuovi dati dal provider (trees/levels/lanes) → follow-up (cambio schema).
- Pseudo-texture / gradiente / griglia finestre → follow-up opzionale.
- Modifica dell'intervallo di zoom o delle strisce/marciapiede (già in place).

## 5. Test (TDD)

Unit (`renderer.test.ts`):
- `groundFill`: colori distinti per classi diverse (park ≠ sand ≠ parking ≠ industrial);
  water ≠ land.
- `roadStyle`: arterie ≠ residenziale (fill o casing); default stabile.
- `buildingStyle`: **deterministico** (stesso seed → stesso colore); seed diversi →
  colori (quasi) diversi; tipo caratteristico (es. "industrial") → colore atteso.
- `positionSeed`: deterministico; (x,y) diversi → seed diversi; round() stabile.

E2E: invariati (contano object, non colori). Nessun test esistente asserisce colori →
il cambio è sicuro per la suite.

## 6. Criteri di verifica

- `npm run typecheck` verde.
- `npm run test:run` verde (unit crescono dei nuovi test palette).
- `npm run build` verde.
- `npm run test:e2e` verde (25 passed + 1 canary skip).
- **Screenshot a zoom vicino**: si vede varietà terreno per land use + strade con
  emfasi per classe + tetti colorati vari (GTA), senza cuciture tra tile.
