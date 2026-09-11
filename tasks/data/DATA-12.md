# DATA-12: Seam tests MVT

**Stato:** completato. Log: `tasks/executions/2026-09-11-DATA-12.md`. **Dipendenze:** DATA-11. **Persona:** test-engineer. **Taglia:** M.

## Obiettivo
Tile sintetiche con: strada che attraversa il bordo, edificio a cavallo,
buco di poligono sul bordo, stessa feature bufferizzata nel vicino.
Verificare: nessun gap, nessuna collisione duplicata, nessuna doppia
facade, output deterministico (ID canonici per segmenti derivati), clip ai
bounds OpenGTA.

## READ
DATA-11, `src/geo/mvt/`, `src/world/compiler/partition.ts` (pattern clip).

## MAY MODIFY / DO NOT TOUCH
Modificabili: normalizer MVT e test. Non cambiare compiler/physics.

## TDD
1. RED: fixture sintetiche con i quattro casi → asserzioni su deduplica,
   chiusura e determinismo.
2. Implementare clip/deduplica/ID deterministici; GREEN.

## Accettazione
- [x] AC1: no gap/duplicati/doppie facade sui bordi.
- [x] AC2: ID deterministici; clip ai bounds OpenGTA.
- [x] AC3: suite verde; obbligatorio prima di dichiarare MVT gameplay-ready.

## Verifica
`npm run test:run -- src/geo/normalize` + gate comune.

## Handoff
DATA-13 consolida il normalizer canonico.
