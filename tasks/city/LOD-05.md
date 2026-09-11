# LOD-05: Culling visuale delle micro-feature

**Stato:** pianificato.
**Dipendenze:** LOD-01.
**Persona:** fullstack-developer.
**Taglia:** M, 4 file di codice/test.

## Obiettivo

Al tier corrente, saltare (solo visivamente) le feature con footprint sotto
la soglia in pixel quadrati del profilo (es. edifici piccoli, barriere
brevi a zoom far). Il world model, featureIndex e le collisioni restano
intatti: il culling e' solo presentazione. Con il renderer incrementale il
cambio tier ricostruisce i soli layer interessati dei chunk attivi.

## READ

- `src/render/pixi/renderer.ts`, `src/app/camera.ts`, `docs/architecture/
  zoom-and-lod.md` §culling.

## MAY MODIFY / DO NOT TOUCH

Modificabili: renderer e test. Non cambiare il compilatore ne' la fisica;
le feature escluse dalla vista restano comunque compilate e collidibili.

## Esecuzione TDD

1. Test RED (browser): a tier far una feature piccola non e' presente nel
  layer visuale ma il suo collider resta in fisica.
2. Implementare la soglia px² dal profilo; test GREEN.
3. Test: cambiando tier la feature ricompare; contatore "culled" esposto
  in snapshot/overlay per il tuning.

## Accettazione

- [ ] AC1: culling per tier applicato, reversibile, solo visuale.
- [ ] AC2: collider invariati; world model intatto.
- [ ] AC3: overlay espone il conteggio; E2E verdi.

## Verifica

`npm run test:run -- src/render` +
`npm run test:e2e -- tests/e2e/live-streaming.spec.ts
tests/e2e/renderer-streaming.spec.ts` + gate comune.

## Handoff

Chiude la Fase C: CITY-02 misura il costo per metro quadro per tier.
