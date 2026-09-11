# DATA-02: Tile math e decoder MVT isolato

**Stato:** pianificato. **Dipendenze:** Nessuna. **Persona:** fullstack-developer. **Taglia:** M.

## Obiettivo
`src/geo/mvt/`: tile math (latLonToTile con clamp Web Mercator, tileBounds,
mercator→projection) e decoder PBF/MVT INTERNO e bounded (max bytes 8 MiB,
max features 10k, max punti 50k, max proprieta' 256; abort; errori
`invalid-tile`/`response-too-large`). Nessuna dipendenza nuova (niente
MapLibre). Fixture reale: `src/fixtures/geo/lecce-z14-openfreemap.pbf`
(OpenFreeMap planet 20260830_080001_pt, tile 14/9019/6181).

## READ
`docs/OpenGTA-DATA-SOURCE-MIGRATION.md` §16-19, spec MVT di Mapbox (link nel
modulo), `src/geo/coordinates/projector.ts`, SECURITY.md.

## MAY MODIFY / DO NOT TOUCH
Modificabili: nuovo `src/geo/mvt/` e test. Non toccare runtime/renderer/
fisica/normalizer OSM. Nessuna dipendenza package.json senza giustificazione
(il decoder e' interno).

## TDD
1. RED: tile math (Lecce→14/9019/6181, clamp lat, determinismo); decoder
   su fixture reale (layer `transportation`/`building` presenti); PBF
   malformato/truncato → errore tipizzato senza crash; limiti superati →
   `response-too-large`/`invalid-tile`.
2. Implementare; GREEN.
3. Test su tile vuota e su geometrie punto/linea/poligono.

## Accettazione
- [ ] AC1: lat/lon→tile deterministico con clamp; nessun NaN/Infinity.
- [ ] AC2: fixture reale decodificata con layer leggibili.
- [ ] AC3: input malformato/oltre-limiti non crasha; errori tipizzati.

## Verifica
`npm run test:run -- src/geo/mvt` + gate comune.

## Handoff
DATA-03/04/05 usano tile math e modello decodificato.
