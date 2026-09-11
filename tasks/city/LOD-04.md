# LOD-04: Dettaglio stradale per tier

**Stato:** completato. Log: `tasks/executions/2026-09-11-LOD-04.md`.
**Dipendenze:** LOD-01.
**Persona:** fullstack-developer.
**Taglia:** S, 3 file di codice/test.

## Obiettivo

Scalare il dettaglio delle strade per tier: FAR solo body delle strade
maggiori, MEDIUM casing e corsie base, NEAR marking/incroci attuali.
Riduce il costo di rendering dei chunk aggiuntivi visibili a zoom lontano.
La geometria stradale compilata non cambia.

## READ

- `src/render/pixi/renderer.ts` (strokeRoadNetwork/casing/marking),
  `src/app/camera.ts`, `docs/architecture/zoom-and-lod.md` §road detail.

## MAY MODIFY / DO NOT TOUCH

Modificabili: renderer e test. Non cambiare classificazione stradale del
compiler ne' le collisioni.

## Esecuzione TDD

1. Test RED (browser): a tier far le marking sono assenti e il casing e'
  ridotto; a near tutto torna come baseline.
2. Implementare dal profilo; test GREEN.
3. Regressione visiva: screenshot baseline/near identici al pre-task.

## Accettazione

- [x] AC1: dettaglio stradale per tier applicato e reversibile.
- [x] AC2: nessun cambiamento a compiler/fisica.
- [x] AC3: E2E streaming e bootstrap verdi.

## Verifica

`npm run test:run -- src/render` +
`npm run test:e2e -- tests/e2e/bootstrap.spec.ts
tests/e2e/live-streaming.spec.ts` + gate comune.

## Handoff

LOD-05 completa la riduzione del costo visuale con il culling per feature.
