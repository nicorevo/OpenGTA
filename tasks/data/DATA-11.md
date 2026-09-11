# DATA-11: OpenFreeMap runtime dietro feature flag

**Stato:** completato. Log: `tasks/executions/2026-09-11-DATA-11.md`. **Dipendenze:** DATA-09. **Persona:** fullstack-developer. **Taglia:** L.

## Obiettivo
`provider=openfreemap-mvt` (sperimentale, MAI default): il runtime usa il
seam `options.compile` con un compiler MVT (provider + resolver + decode +
mapping → compileRegion) e source placeholder mai chiamata. Stessi chunk
grid, lifecycle, fisica, renderer, spawn, availability guard; cache
namespace con provider/dataset/z14/normalizer version. Consenso
provider-neutral. E2E con tile intercettate (fixture PBF): first playable
e 10+ chunk attraversati.

## READ
DATA-02..10, `src/world/runtime/open-world.ts`, `src/world/runtime/live-config.ts`,
`src/app/bootstrap.ts`, `tests/e2e/live-streaming.spec.ts`.

## MAY MODIFY / DO NOT TOUCH
Modificabili: live-config, bootstrap, nuovo `src/world/runtime/vector-tile/compile.ts`,
test E2E. Non cambiare chunk grid/fisica/renderer/spawn/guardia.

## TDD
1. RED: E2E `provider=openfreemap-mvt` con tile fixture servite localmente:
   ready + guida oltre 3 confini.
2. Implementare compiler MVT nel seam; GREEN.
3. Test: namespace isolato da Overpass; errori tile → degraded non crash.

## Accettazione
- [x] AC1: first playable con tile fixture; 10+ chunk attraversati.
- [x] AC2: nessun branch provider-specifico in fisica/renderer/spawn.
- [x] AC3: retry/recovery e stop/restart funzionanti; suite verde.

## Verifica
`npm run test:run` + `npm run test:e2e -- tests/e2e/mvt-live.spec.ts` + gate comune.

## Handoff
DATA-12 indurisce i seam; DATA-13 sposta il mapping nel normalizer canonico.
