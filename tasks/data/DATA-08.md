# DATA-08: Mapping land/water

**Stato:** pianificato. **Dipendenze:** DATA-05. **Persona:** fullstack-developer. **Taglia:** S.

## Obiettivo
Layer `park`/`landuse`/`landcover` → `LandAreaFeature` (classi esistenti:
park, grass, forest, ...); `water`/`waterway` (poligoni) → `WaterFeature`.
Primo passaggio: strade, edifici, parchi, acqua. Gap dichiarati (barriere,
alberi: verificare, non inventare).

## READ
`src/geo/mvt/model.ts`, `src/geo/normalize/osm.ts` (landClass/waterClass).

## MAY MODIFY / DO NOT TOUCH
Modificabili: `src/geo/normalize/mvt-land.ts` (nuovo) + test.

## TDD
1. RED: poligoni park/landuse/water → feature con styleKey attese;
   classe ignota → warning.
2. Implementare; GREEN.

## Accettazione
- [ ] AC1: park/landuse/landcover/water/waterway mappati.
- [ ] AC2: gap (barriere/trees) dichiarati, mai dati inventati.
- [ ] AC3: suite verde.

## Verifica
`npm run test:run -- src/geo/normalize` + gate comune.

## Handoff
DATA-09 misura la parity con Overpass.
