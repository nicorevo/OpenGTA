# ZOOM-01: Stato camera puro

**Stato:** pianificato.
**Dipendenze:** Nessuna.
**Persona:** fullstack-developer.
**Taglia:** S, 2 file di codice/test.

## Obiettivo

Creare `src/app/camera.ts`: modulo puro con `ZoomLevel = 0..4`,
`ZOOM_STEPS` (valori sperimentali `[0.70, 0.85, 1.0, 1.20, 1.45]`),
`clampZoom`, `zoomFactor`, `lodForZoom` (placeholder per LOD-01),
`cameraBounds(position, screenSize, scale)`. Nessuna dipendenza da
Pixi/Rapier/DOM; testabile con Vitest puro.

## READ

- `docs/architecture/zoom-and-lod.md`, `docs/adr/ADR-010-discrete-zoom-lod.md`,
  `src/render/pixi/renderer.ts` (viewScale/cameraBounds attuali).

## MAY MODIFY / DO NOT TOUCH

Modificabili: solo il nuovo modulo e il suo test. Non toccare il renderer in
questa slice; i fattori sono dichiaratamente sperimentali.

## Esecuzione TDD

1. Test RED: `cameraBounds` con scale diverse restringe/allarga i bounds
   attorno al centro; clamp fuori range.
2. Implementare il modulo; test GREEN.
3. Test aggiuntivi: centro preservato, bounds simmetrici, zoomFactor
   monotono crescente.

## Accettazione

- [ ] AC1: clamp min/max e fattori testati; nessuna import da Pixi/Rapier.
- [ ] AC2: bounds si restringono su zoom in e si allargano su zoom out.
- [ ] AC3: modulo esportato per ZOOM-02 senza API DOM.

## Verifica

`npm run test:run -- src/app/camera.test.ts` + gate comune.

## Handoff

ZOOM-02 importa il modulo; LOD-01 implementa `lodForZoom` reale.
