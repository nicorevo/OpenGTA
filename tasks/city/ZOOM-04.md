# ZOOM-04: Streaming reagisce allo zoom

**Stato:** completato. Log: `tasks/executions/2026-09-11-ZOOM-04.md`.
**Dipendenze:** ZOOM-03.
**Persona:** fullstack-developer.
**Taglia:** M, 3 file di codice/test.

## Obiettivo

Al cambio di zoom `cameraBounds()` cambia, la firma di stream della sessione
cambia e il runtime aggiorna la domanda con il debounce esistente (200 ms):
zoom out estende la domanda visiva, zoom in la riduce. Nessuna tempesta di
richieste con pressioni rapide `- - - + +`. La guardia di disponibilita'
resta basata sui chunk APPLICATI: lo zoom out non rende percorribile
territorio non caricato.

## READ

- `src/app/runtime-session.ts` (stream/signature), `src/world/chunk/window.ts`,
  `src/app/camera.ts`, C-CAMERA e C-SESSION in `tasks/online/README.md`.

## MAY MODIFY / DO NOT TOUCH

Modificabili: sessione e test. Non cambiare scheduler, window selection o
guardia fisica. Non aggiungere fetch per frame.

## Esecuzione TDD

1. Test RED: con sessione attiva, zoom out allarga i bounds e la domanda
   include nuove celle entro il debounce; raffica di zoom produce al massimo
   le richieste attese (contatore source).
2. Implementare (la firma gia' include cameraBounds: verificare e fissare
   eventuali punti mancanti); test GREEN.
3. Test: zoom out NON sblocca il movimento in celle non applicate
   (guardia invariata).

## Accettazione

- [x] AC1: domanda aggiornata al cambio zoom entro 200 ms, deduplicata.
- [x] AC2: nessuna tempesta di richieste su raffiche; limiti coda rispettati.
- [x] AC3: confinamento fisico invariato; suite completa ed E2E verdi.

## Verifica

`npm run test:run -- src/app/runtime-session.test.ts` +
`npm run test:e2e -- tests/e2e/zoom.spec.ts tests/e2e/live-streaming.spec.ts`
+ gate comune.

## Handoff

ZOOM-05 raccoglie i benchmark dei fattori; LOD riduce il costo dei chunk
aggiuntivi richiesti dallo zoom out.
