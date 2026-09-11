# ZOOM-05: Test zoom completi e benchmark fattori

**Stato:** pianificato.
**Dipendenze:** ZOOM-04.
**Persona:** test-engineer.
**Taglia:** M, 3 file di test.

## Obiettivo

Copertura unit (clamp, centro, bounds, monotonia) ed E2E (click +/-, mondo
visivamente piu' grande/piccolo, auto centrata, sessione stabile, nessun
page error). Benchmark per livello (visible meters, chunks, feature count,
p95 frame) con ambiente dichiarato: i valori finali di `ZOOM_STEPS` vengono
fissati o corretti sulla base delle misure.

## READ

- `src/app/camera.test.ts`, `tests/e2e/zoom.spec.ts`, `tests/e2e/measurements.spec.ts`,
  `docs/testing/benchmark-protocol-v0.md`.

## MAY MODIFY / DO NOT TOUCH

Modificabili: test e (solo se giustificato dai benchmark) `ZOOM_STEPS`.
Non cambiare il motore per far passare le misure.

## Esecuzione

1. Estendere i test unit del modulo camera.
2. E2E: screenshot per livello (artefatti fuori repo), stato sessione dopo
   ogni click, nessun errore console.
3. Benchmark: report per livello nel log con metodo e ambiente; decisione
   documentata sui fattori.

## Accettazione

- [ ] AC1: unit ed E2E coprono limiti, centro, bounds e stabilita'.
- [ ] AC2: report per livello con ambiente dichiarato; fattori giustificati.
- [ ] AC3: suite completa, typecheck, build ed E2E verdi.

## Verifica

`npm run test:run -- src/app/camera.test.ts` +
`npm run test:e2e -- tests/e2e/zoom.spec.ts` + gate comune + benchmark.

## Handoff

I fattori fissati alimentano LOD-01 (`lodForZoom`) e il gate CITY-02.
