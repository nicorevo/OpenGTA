# Zoom Ravvicinato — Look GTA 1 (V1)

**Status:** Initial specification (define-first, pre-implementation)
**Reference:** screenshot GTA 1 top-down (auto grande, strisce tratteggiate,
marciapiedi, facciate edifici)
**Depends on:** F1 vehicle (baseline `568dcc0`), discrete zoom + LOD tiers

## Goal

Consentire di zoomare fino a un livello "avvicinato" stile GTA 1 (auto grande,
~30–40 px/m) con i dettagli di strada che quel livello richiede: linee di
carreggiata tratteggiate, marciapiedi attorno alle strade e facciate degli
edifici già estruse. Il look distante (default) resta invariato.

## Why it is feasible (data grounding)

Il renderer è vettoriale (PixiJS `Graphics`): scala liscio a qualsiasi
`viewScale`. I dati già presenti bastano, **senza nuove fonti**:

- `roads[]` portano `centerline` (Vec2[]) e `widthMeters` → da qui derivano
  sia il **tratteggio** (lungo la centerline) sia il **marciapiede**
  (centerline stirata di `widthMeters/2 + sidewalkWidth`).
- `buildings[]` portano `roof` + `visualHeightMeters` → le facciate sono già
  estruse sul tier `near` (`facadeStrength = 1`, `lod-profile.ts`).
- `ground[]` sono solo `land:*`/`water:*` (nessun `landClass` sidewalk) →
  il marciapiede **si deriva**, non si legge.
- Limiti: il road compilato **non** espone `laneCount` (`compiled.ts:37` lo
  scarta). Le strisce laterali si stimano da `widthMeters`; il tratto centrale
  (il più iconico) basta la `centerline`.

## Design decisions

### D1 — Intervallo di zoom (`camera.ts`)

Mantengo il tipo `ZoomLevel = 0|1|2|3|4`, il default a livello 2 e il mapping
LOD invariato (`0-1` far, `2` medium, `3-4` near). Allargo solo l'alto:

```text
ZOOM_STEPS = [0.7, 0.85, 1.0, 4.0, 14.0]
            |______ livelli 0-2 invariati (default = 1.0, ~2.5 px/m a 900px) |
            livello 3 = 4.0  (~10 px/m, ravvicinato intermedio)
            livello 4 = 14.0 (~35 px/m a 900px, auto ~140 px, look GTA 1)
```

I fattori restano "experimental" (commento ZOOM-05) e si ricalibrano su
screenshot (CZ-04). I test già esistenti (`camera.test.ts`) vincolano:
lunghezza 5, `ZOOM_STEPS[2] === 1`, fattori strettamente crescenti, mapping
tier invariato → tutti rispettati.

### D2 — Marciapiede (`renderer.ts`)

Nuovo layer `sidewalkLayer` sotto `roadCasingLayer`. Per ogni strada stirò la
`centerline` con larghezza totale `(widthMeters + 2·SIDEWALK_WIDTH_M)·scale`
in grigio pavimentato (es. `0x9a9a92`), riutilizzando il percorso
`queueCenterlines`/`strokeRoadNetwork` con `pad = SIDEWALK_WIDTH_M·scale`.
L'asfalto (stirato più stretto, sopra) copre il centro e resta un bordo
grigio di `SIDEWALK_WIDTH_M` (≈1.8 m) = il marciapiede. Ai incroci i bordi si
fondono (corretto). Gate: `roadDetail !== "body"` (medium + near).

### D3 — Strisce tratteggiate (`renderer.ts`)

Nuovo layer `roadMarkingLayer` sopra `roadSurface`/`corridor`. Helper puro
`dashSegments(points, dashM, gapM): Vec2[][]` percorre la `centerline` a
distanza cumulativa ed emette tratti lunghi `dashM` (≈2.5 m) con buche di
`gapM` (≈2.5 m). Il renderer li disegna sottili (~0.18 m, mai più stretti di
~1.5 px a schermo, così restano leggibili anche al tier medium) in bianco
(`0xffffff`). PixiJS v8 `stroke()` non ha dash nativo → emissione
manuale dei segmenti (funzione pura, testabile). Gate: `roadDetail !==
"body"` (medium + near), cioè la striscia centrale è visibile nel gioco
normale, non solo al massimo zoom. zIndex per larghezza strada (coerente a
`roadCasing`).

### D4 — Facciate (già fatte)

Le facciate estruse esistono già e sono attive sul tier `near`
(`facadeStrength = 1`). Nessun lavoro richiesto; la finestra/finitura è
opzionale e differita (non blocca il look).

## Task mapping (dettaglio in `tasks/plan.md`)

```text
CZ-01  Intervallo di zoom: ZOOM_STEPS alto + mapping tier (camera.ts)
CZ-02  Marciapiede: sidewalkLayer + pad (renderer.ts)
CZ-03  Strisce: dashSegments + roadMarkingLayer (renderer.ts)
CZ-04  Verifica: screenshot zoom ravvicinato + gate completa
CZ-05  Doc: result, CURRENT.md, README baseline
```

## Verification

- **Unit (TDD):**
  - `camera.test.ts`: `zoomFactor(4)` porta lo scale a ~30+ px/m su 720px;
    default resta 1.0; tier map invariata.
  - helper puri: `sidewalkPadPx(scale)` e `dashSegments(...)` (contagiri
    tratti, lunghezza, copertura, no gap nel centro della centerline).
  - `renderer.test.ts` (FakeGraphics): sul tier near compaiono lo stroke del
    marciapiede (larghezza maggiore dell'asfalto) e i segmenti tratteggiati;
    su medium/far no. `presentationDiagnostics()` espone `sidewalks`/
    `roadMarkings` booleani per il test e per il debug overlay.
- **Visiva (CZ-04):** screenshot a `zoom=4` in scena reale: auto grande,
  strisce tratteggiate, marciapiedi, facciate. Ricalibro il fattore 4 se
  serve.
- **Gate:** `npm run typecheck`, `npm run test:run`, `npm run build`,
  `npm run test:e2e` verdi. Guida a zoom ravvicinato senza tunneling/crash.

## Rischi e mitigazioni

| Rischio | Gestione |
| --- | --- |
| Fattore 4 non basta / troppo chiuso | Fattore "experimental": ricalibro su screenshot (CZ-04) |
| Tratteggio a schermi grandi/granulari | Lunghezza in metri (non px): scala con lo zoom, costante nel mondo |
| Incroci: marciapiedi si sovrappongono | Stroke con cap/join round: si fondono in un'unica sagoma |
| Performance a zoom ravvicinato | Area visibile piccola (pochi chunk, poche feature): più leggera del lontano |
| Strisce laterali senza `laneCount` | Mi limito al tratto centrale (iconico); le laterali si stimano da `widthMeters` se serve |
