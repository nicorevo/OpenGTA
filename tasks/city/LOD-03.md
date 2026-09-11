# LOD-03: Facade per tier

**Stato:** completato. Log: `tasks/executions/2026-09-11-LOD-03.md`.
**Dipendenze:** LOD-01.
**Persona:** fullstack-developer.
**Taglia:** S, 3 file di codice/test.

## Obiettivo

Moltiplicare l'altezza visiva della facade fake-2.5D per la forza del tier
(FAR ~0, MEDIUM_FAR 0.25, DEFAULT 0.6, MEDIUM_NEAR 0.85, NEAR 1 — valori
iniziali dal profilo LOD-01). La geometria autorevole e le collisioni non
cambiano: solo l'estrusione visiva.

## READ

- `src/render/pixi/renderer.ts` (drawPolygon/facade), `src/app/camera.ts`,
  `docs/architecture/zoom-and-lod.md` §facade.

## MAY MODIFY / DO NOT TOUCH

Modificabili: renderer e test. Non toccare altezze del modello o compiler;
nessun cambio alla paletta in questa slice.

## Esecuzione TDD

1. Test RED (browser): a zoom far la facade e' azzerata/ridotta rispetto a
  near (misurare l'offset visuale via API di test o screenshot).
2. Implementare `facadeStrength(tier)` dal profilo; test GREEN.
3. Test: tornando a near la facade completa ritorna identica.

## Accettazione

- [x] AC1: forza facade per tier applicata e reversibile.
- [x] AC2: nessun effetto su fisica o world model.
- [x] AC3: E2E renderer-streaming verdi; screenshot far/near dichiarati.

## Verifica

`npm run test:run -- src/render` +
`npm run test:e2e -- tests/e2e/renderer-streaming.spec.ts` + gate comune.

## Handoff

LOD-04 prosegue con il dettaglio stradale; il profilo unico resta in
LOD-01.
