# Zoom ravvicinato (look GTA 1) — zoom esteso, strisce e marciapiedi

Data: 2026-09-18. Spec: `docs/specs/close-zoom-v1.md`. Persona: fullstack-developer.
Stato: completato + verificato; incluso nella baseline del commit di questa tranche.

## Obiettivo

Portare lo zoom fino alla vista "auto grande" (top-down tipo GTA 1) senza toccare fisica,
spawn o LOD, e rendere la scena leggibile da vicino: marciapiedi attorno alle strade e
striscia centrale tratteggiata, usando solo dati già nel chunk (`centerline`,
`widthMeters`).

## Cosa è cambiato

- `camera.ts`: `ZOOM_STEPS = [0.7, 0.85, 1.0, 4.0, 14.0]` (5 livelli). Default ×1.0
  invariato; livello 4 ≈ 35 px/m a 900 px. `lodForZoom` invariato (0-1 far, 2 medium,
  3-4 near).
- `renderer.ts`:
  - Nuovo layer `sidewalkLayer`: fascia grigia (~1.8 m) attorno alla carreggiata, attiva
    da **medium** in su.
  - Nuovo layer `roadMarkingLayer`: striscia centrale tratteggiata **bianca**
    (`0xffffff`, dash 2.5 m / gap 2.5 m, ~0.18 m, mai più stretta di ~1.5 px a schermo),
    attiva da **medium** in su → visibile nel gioco normale, non solo al max-zoom.
  - `graphicsObjects` per chunk: 5 → 7 (aggiunti `sidewalk` + `roadMarking`); gli e2e di
    conteggio (`* 7`) restano verdi.
- Helper puri (testabili): `sidewalkPadPx`, `sidewalkEnabled`, `roadMarkingsEnabled`,
  `dashSegments`.

## Verifica

- `npm run typecheck` verde.
- `npm run test:run`: **435/435** (final state della tranche).
- `npm run build` verde (warning chunk-size preesistente).
- `npm run test:e2e`: 25 passed + 1 canary skip. Nota: i test di guida real-time
  (`bootstrap`, `touch-controls`) sono flaky sotto carico in suite completa; verdi in
  isolamento e non toccati da questa tranche.
- Screenshot: zoom normale `/tmp/opengta-centerline-white.png` (striscia centrale bianca
  + marciapiede + auto F1), zoom vicino `/tmp/opengta-gta-road.png`.

## Follow-up (non incluso)

- Finestre/opacità facciata (solo `near`) e ombra a terra edificio: estetico differito.
- Etichette: i nomi delle **acque** (fiumi/laghi) erano ricevuti ma non pubblicati → ora
  pubblicati come label (vedi commit dedicato + `compiled.test.ts`).
