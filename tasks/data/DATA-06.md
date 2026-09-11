# DATA-06: Mapping transportation

**Stato:** completato. Log: `tasks/executions/2026-09-11-DATA-06.md`. **Dipendenze:** DATA-05. **Persona:** fullstack-developer. **Taglia:** M.

## Obiettivo
Mappare il layer `transportation` OpenMapTiles verso `RoadFeature`:
motorway→motorway, trunk→trunk, primary→primary, secondary→secondary,
tertiary→tertiary, minor→residential (fallback), service→service, path/
track→non guidabili (`pedestrian`), rail/ignote→warning e skip. Larghezza
dai fallback esistenti del compiler (i tile non hanno width/lanes).
Classificazione interna `drivable-road | pedestrian | rail | ignored`.

## READ
`src/geo/mvt/model.ts`, `src/geo/normalize/osm.ts` (roadClasses/widths),
`src/world/model/types.ts`.

## MAY MODIFY / DO NOT TOUCH
Modificabili: `src/geo/normalize/mvt-roads.ts` (nuovo) + test. Non cambiare
compiler/OSM normalizer/renderer.

## TDD
1. RED: fixture sintetica MVT con classi note/ignote → RoadFeature con
   classi attese, warning per ignote, path/rail classificati correttamente.
2. Implementare; GREEN.

## Accettazione
- [x] AC1: mapping classi OMT→OpenGTA con fallback documentati.
- [x] AC2: non guidabili mai trasformati in carreggiata; warning ignote.
- [x] AC3: larghezza dai fallback; suite verde.

## Verifica
`npm run test:run -- src/geo/normalize` + gate comune.

## Handoff
DATA-09 usa il mapping per la parity; DATA-13 lo compone nel normalizer.
