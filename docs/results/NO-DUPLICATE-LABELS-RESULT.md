# Nomi via/luoghi duplicati — dedup per feature

Data: 2026-09-21. Persona: fullstack-developer.
Stato: completato + verificato. Baseline: working tree post LB (nomi
leggibili, non ancora commitato). Log: `tasks/executions/2026-09-21-ND-01.md`.

## Obiettivo

Verifica richiesta dall'utente: il meccanismo dei nomi via/luoghi duplicava i
nomi. Confermato: il nome si ripeteva una volta per ogni chunk attraversato
dalla via (~600 m), e le way ad anello duplicavano anche dentro lo stesso
chunk.

## Diagnosi

- Ogni chunk compila un box ±300 m (una cella) centrato su sé stesso.
- OSM: `normalizeOsm` spezza le way al box in `part:N`, ognuna col nome;
  MVT: ogni chunk fonde i propri tile in una catena tagliata al box.
- `compileRegion` emette un label per feature (per parte) al centroide della
  parte.
- `partitionCompiledChunk` filtra i label per posizione, ma ogni chunk ha la
  propria copia con il proprio centroide → ogni chunk tiene il proprio label.
- MVT in più: edifici/parchi/acque che tagliano un bordo tile diventano metà
  poligono (`#hN`/`#aN`/`#wN`) che conservano entrambe il nome.

## Cosa è cambiato

- `labelDedupKey(featureId)` (puro, esportato): identità stabile della
  feature, featureId senza il suffisso per-chunk (`:part:N` OSM,
  `#pN`/`#hN`/`#aN`/`#wN` MVT).
- `rebuildLabels` deduplica i label visibili dei chunk attivi per quella
  chiave: una sola copia per feature, vince la più vicina al bersaglio
  camera → il nome resta sul tratto di strada visibile (comportamento
  per-tile delle mappe reali, senza i ripetuti).
- Solo renderer: contratto chunk, normalizer, LOD e cache persistente
  invariati.

## Verifica

- RED: 6/18 falliti in `renderer-labels.test.ts` (helper mancante + 2 Text
  invece di 1); e2e pre-fix `labelTextCount` = 2.
- `npm run test:run`: 453/453 (era 447: +6 test).
- `npm run typecheck`, `npm run build`: verdi.
- `npm run test:e2e`: 27 passed + 1 canary skip, con il nuovo guard
  `labelTextCount === 1` (2 chunk, stessa feature, 1 Text) nel browser.

## Follow-up (non incluso)

- Etichettatura "per tratto visibile" (nome a ogni N metri lungo strade
  lunghe) se richiesto: oggi il nome appare una volta, sul tratto più vicino
  alla camera.
- Ownership a livello dati (anchor stabile nel chunk) come alternative più
  pesanti: non necessarie finché il dedup nel renderer copre tutti i casi.
