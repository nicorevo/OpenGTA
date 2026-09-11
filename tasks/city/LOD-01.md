# LOD-01: Politica zoom→LOD

**Stato:** pianificato.
**Dipendenze:** ZOOM-01.
**Persona:** fullstack-developer.
**Taglia:** S, 2 file di codice/test.

## Obiettivo

Implementare `lodForZoom(level)` reale in `src/app/camera.ts`:
mapping iniziale sperimentale 0-1 -> far, 2 -> medium, 3-4 -> near.
Profilo di presentazione per tier centralizzato (`LodPresentationProfile`:
facade strength, road detail, label soglia, culling soglia px²) in
`src/render/` — mai nel canonical world. Tutti i valori sono parametri,
non logica sparsa.

## READ

- `src/app/camera.ts`, `docs/architecture/zoom-and-lod.md`,
  `docs/architecture/2d-rendering-model.md` §26-27.

## MAY MODIFY / DO NOT TOUCH

Modificabili: modulo camera, nuovo profilo presentazione, test. Non cambiare
`src/world`/`src/geo`; il LOD non deve alterare featureId, geometria o
collisioni.

## Esecuzione TDD

1. Test RED: `lodForZoom` copre tutti i livelli; profilo con valori
  coerenti e monotoni (facade cresce con lo zoom in, culling cresce con
  lo zoom out).
2. Implementare; test GREEN.
3. Test di confine: livello fuori range -> clamp prima del mapping.

## Accettazione

- [ ] AC1: mapping totale e deterministico, testato per ogni livello.
- [ ] AC2: profilo centralizzato senza dipendenze da Pixi nel contratto.
- [ ] AC3: nessuna modifica al canonical world; suite verde.

## Verifica

`npm run test:run -- src/app/camera.test.ts` + gate comune.

## Handoff

LOD-02..05 consumano il profilo; i mapping si ricalibrano con i fattori
fissati in ZOOM-05.
