# LOD-02: Etichette per tier

**Stato:** pianificato.
**Dipendenze:** LOD-01, SOLID-04.
**Persona:** fullstack-developer.
**Taglia:** S, 3 file di codice/test.

## Obiettivo

Applicare al rendering delle etichette la soglia del tier: NEAR tutte le
label attuali, MEDIUM solo strade/piazze principali, FAR quartieri/luoghi
maggiori. Con il renderer incrementale, il cambio tier aggiorna solo le
label visibili (ricostruzione del layer label per i chunk attivi, costo
bounded), non la scena intera. Deduplicazione fra chunk al FAR se banale.

## READ

- `src/render/pixi/renderer.ts` (labelLayer/toggleLabels), `src/app/camera.ts`,
  `docs/architecture/zoom-and-lod.md`.

## MAY MODIFY / DO NOT TOUCH

Modificabili: renderer e test. Non cambiare la generazione delle label nel
compiler ne' `toggleLabels`; il toggle utente resta prioritario sul tier.

## Esecuzione TDD

1. Test RED (browser): a livello far le label di strade minori non sono
  presenti; tornando a near ricompaiono.
2. Implementare il filtro per tier nel builder label; test GREEN.
3. Test: toggle L manuale continua a funzionare a ogni tier.

## Accettazione

- [ ] AC1: soglie per tier applicate e reversibili cambiando zoom.
- [ ] AC2: nessun effetto su featureIndex/geometria; solo presentazione.
- [ ] AC3: E2E renderer-streaming e bootstrap verdi.

## Verifica

`npm run test:run -- src/render` +
`npm run test:e2e -- tests/e2e/bootstrap.spec.ts
tests/e2e/renderer-streaming.spec.ts` + gate comune.

## Handoff

LOD-05 aggiunge il culling per feature; il profilo unico evita soglie
duplicate.
