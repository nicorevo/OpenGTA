# DATA-07: Mapping building

**Stato:** pianificato. **Dipendenze:** DATA-05. **Persona:** fullstack-developer. **Taglia:** S.

## Obiettivo
Layer `building` → `BuildingFeature`: poligoni con holes; altezza da
`render_height` se presente, altrimenti fallback deterministico del
progetto (9 m / levels); collisionPolicy solid di default. Geometrie
invalide → warning e skip, mai crash.

## READ
`src/geo/mvt/model.ts`, `src/geo/normalize/osm.ts` (pattern building).

## MAY MODIFY / DO NOT TOUCH
Modificabili: `src/geo/normalize/mvt-buildings.ts` (nuovo) + test.

## TDD
1. RED: poligono con render_height → altezza; senza → fallback; buco
   interno preservato; geometria aperta → warning.
2. Implementare; GREEN.

## Accettazione
- [ ] AC1: render_height/fallback deterministico.
- [ ] AC2: holes preservati; geometrie invalide con warning, no crash.
- [ ] AC3: suite verde.

## Verifica
`npm run test:run -- src/geo/normalize` + gate comune.

## Handoff
DATA-08 prosegue con land/water.
