# DATA-09: Parity Lecce (Overpass vs OpenFreeMap)

**Stato:** pianificato. **Dipendenze:** DATA-06..08. **Persona:** test-engineer. **Taglia:** M.

## Obiettivo
Confrontare, su Piazza Sant'Oronzo, la baseline Overpass (fixture
committata `lecce-sant-oronzo-v0.raw.json` — Overpass live irraggiungibile
da questo ambiente) con OpenFreeMap z14 (fixture `lecce-z14-openfreemap.pbf`):
road/building/park/water count, compiled feature count, collision count,
bytes, decode/normalize/compile ms, gap barriere/alberi. Output:
`docs/analysis/MVT-LECCE-PARITY.md` con decisione GO / GO VISUAL ONLY /
NO-GO GAMEPLAY per la source pubblica z14.

## READ
Le due fixture, `src/geo/normalize/`, `src/world/compiler/`,
`docs/testing/benchmark-protocol-v0.md`.

## MAY MODIFY / DO NOT TOUCH
Modificabili: script di parity (tests/bench/mvt-parity.test.ts o script),
doc di analisi. Non cambiare mapping per migliorare i numeri.

## TDD
1. RED: script che produce la matrice di conteggi (senza soglie fisse).
2. GREEN con esecuzione e matrice completa.
3. Analisi documentata con decisione motivata.

## Accettazione
- [ ] AC1: matrice completa con numeri reali e ambiente dichiarato.
- [ ] AC2: decisione GO/GO-VISUAL/NO-GO motivata e documentata.
- [ ] AC3: gap dichiarati; nessun dato inventato.

## Verifica
`npx vitest run --config vitest.bench.config.ts tests/bench/mvt-parity.test.ts` + gate comune.

## Handoff
DATA-10 benchmarka; DATA-11 integra il runtime con la decisione in mano.
