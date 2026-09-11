# DATA-05: Modello decodificato

**Stato:** pianificato. **Dipendenze:** DATA-02. **Persona:** fullstack-developer. **Taglia:** S.

## Obiettivo
`DecodedVectorTile`/`DecodedVectorFeature` (layer, id?, properties,
geometria tipizzata punto/linea/poligono con rings e holes): l'unico
confine verso il canonical world; nessun oggetto del decoder esposto.
Bounded count di layer/feature; tile vuota = modello vuoto valido.

## READ
`src/geo/mvt/` (DATA-02).

## MAY MODIFY / DO NOT TOUCH
Modificabili: `src/geo/mvt/model.ts` + test.

## TDD
1. RED: decode della fixture reale → modello con feature tipizzate;
   tile vuota → vuoto valido; feature count oltre limite → errore.
2. Implementare; GREEN.

## Accettazione
- [ ] AC1: modello tipizzato con geometrie complete (holes preservati).
- [ ] AC2: nessun oggetto decoder esposto fuori da src/geo/mvt.
- [ ] AC3: tile vuota = vuoto valido; suite verde.

## Verifica
`npm run test:run -- src/geo/mvt` + gate comune.

## Handoff
DATA-06..08 mappano il modello verso le feature OpenGTA.
