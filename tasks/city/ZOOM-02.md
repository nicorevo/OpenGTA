# ZOOM-02: API zoom del renderer

**Stato:** completato. Log: `tasks/executions/2026-09-11-ZOOM-02.md`.
**Dipendenze:** ZOOM-01, SOLID-04.
**Persona:** fullstack-developer.
**Taglia:** M, 3 file di codice/test.

## Obiettivo

`viewScale = baseScale * zoomFactor(zoomLevel)` nel renderer; API
`setZoom(level)`, `zoomIn()`, `zoomOut()`, `cameraState()` con clamp.
`cameraBounds()` deriva dalla nuova scala: la domanda di streaming reagisce
senza contratti nuovi. Centro camera e posizione veicolo invariati a ogni
zoom; fisica e fixed-step intoccati.

## READ

- `src/render/pixi/renderer.ts`, `src/app/camera.ts`, `src/app/runtime-session.ts`
  (interfaccia SessionRenderer), C-CAMERA in `tasks/city/README.md`.

## MAY MODIFY / DO NOT TOUCH

Modificabili: renderer, interfaccia SessionRenderer, sessione (solo
propagazione dello stato), test. Non cambiare baseScale, world.scale al di
fuori del fattore, o updateVehicle.

## Esecuzione TDD

1. Test RED (browser): `setZoom` cambia `cameraState().zoomFactor` e
   `cameraBounds()` coerentemente; centro invariato.
2. Implementare; test GREEN.
3. Sessione: esporre `zoomLevel` in snapshot (per overlay/stream).

## Accettazione

- [x] AC1: zoom in/out rispettano i limiti e il centro camera resta il
  veicolo.
- [x] AC2: bounds cambiano coerentemente; nessun effetto su fisica o spawn.
- [x] AC3: V0 offline invariato (zoom default = 1.0); E2E esistenti verdi.

## Verifica

`npm run test:run -- src/render src/app/camera.test.ts` +
`npm run test:e2e -- tests/e2e/bootstrap.spec.ts
tests/e2e/renderer-streaming.spec.ts` + gate comune.

## Handoff

ZOOM-03 aggiunge i controlli; ZOOM-04 verifica la reazione dello streaming.
