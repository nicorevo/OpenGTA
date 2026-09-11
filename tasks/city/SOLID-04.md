# SOLID-04: Renderer incrementale per chunk

**Stato:** pianificato.
**Dipendenze:** Nessuna.
**Persona:** fullstack-developer.
**Taglia:** L, 6 file di codice/test.

## Obiettivo

Sostituire il rebuild completo della scena statica con presentazioni per
chunk: `setChunk` costruisce solo il nuovo chunk, `updateChunk` sostituisce
il contenuto dello stesso id, `removeChunk` distrugge solo le sue risorse.
Chunk invariato = zero rebuild/allocazione. `render(list)` resta come
compatibilita' V0 e rebuild esplicito. Costo `O(chunks_changed)`.

## READ

- `src/render/pixi/renderer.ts`, `src/app/runtime-session.ts` (onChunkReady/
  onChunkRemoved/scheduleRender), C-RESOURCES in `tasks/online/README.md`,
  `docs/architecture/zoom-and-lod.md` (struttura ChunkPresentation).

## MAY MODIFY / DO NOT TOUCH

Modificabili: renderer e test, chiamate della sessione. Non cambiare il
modello compilato, la fisica o l'ordine visuale globale (ground < roads <
buildings < labels) e le mask. Preservare `render`, `updateVehicle`,
`toggleLabels`, `cameraBounds`, `dispose`.

## Esecuzione TDD

1. Test RED (browser/unit del renderer): dopo `setChunk(A)` il secondo
   `setChunk(B)` non distrugge i figli di A (spie sui container).
2. Implementare ChunkPresentation con container per tipo di layer; migrare
   il disegno attuale nei builder per chunk; sessione usa set/update/remove.
3. Test GREEN + regressioni esistenti (hole, ordine, label, resize,
   renderer-streaming E2E) tutte verdi.

## Accettazione

- [ ] AC1: chunk invariato conserva le stesse risorse (nessun rebuild).
- [ ] AC2: 1 chunk nuovo non ricrea gli altri; 1 rimosso distrugge solo il suo.
- [ ] AC3: E2E streaming e V0 senza regressioni visive (screenshot di
  confronto dichiarati nel log).

## Verifica

`npm run test:run -- src/render` + `npm run test:e2e -- tests/e2e/
bootstrap.spec.ts tests/e2e/renderer-streaming.spec.ts
tests/e2e/live-streaming.spec.ts` + gate comune.

## Handoff

ZOOM-02 e LOD-01..05 si appoggiano alle presentazioni per chunk; il
ribilanciamento dei tier non deve piu' costare un rebuild globale.
