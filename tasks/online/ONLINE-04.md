# ONLINE-04: Aggiornare la scena preservando il veicolo

**Stato:** pianificato.
**Dipendenze:** nessuna.
**Persona:** fullstack-developer.
**MODEL CLASS:** STANDARD. **REASONING:** high.
**Taglia:** M, circa 3-5 file di codice/test.
**Finding:** prerequisito grafico di F3/F4.

## Obiettivo

Il renderer deve accettare chunk aggiunti, sostituiti o rimossi durante una
sessione senza ricreare l'auto o azzerare camera e label. Oggi render distrugge
tutti i children e ricrea anche il veicolo. Questo task rende l'API utilizzabile
dal live progressivo, conservando l'aspetto e il percorso V0.

## READ

- Letture comuni e C-RESOURCES in [README](README.md).
- `src/render/pixi/renderer.ts`, `src/render/pixi/renderer.test.ts`, `src/render/pixi/scene-order.ts`, `src/render/pixi/scene-order.test.ts`.
- `src/render/pixi/presentation.ts`, `src/world/compiler/compiled.ts`.
- `src/app/bootstrap.ts`, `tests/e2e/bootstrap.spec.ts`.

## MAY MODIFY / DO NOT TOUCH

Modificabili: renderer e relativi test, eventualmente un helper locale di
composizione con test, `tests/e2e/renderer-streaming.spec.ts` (nuovo).
Non cambiare style profile, compiler, feature identity o fisica. Non passare
a WebGPU/Three.js, non introdurre un framework UI o un secondo motore.

## Esecuzione TDD

1. Con due chunk sintetici adiacenti verificare A -> A+B -> B -> insieme vuoto.
   Impostare prima una pose e label visibili: aggiornare i chunk deve preservare
   pose, camera e presentazione. Il set vuoto rimuove il mondo statico ma non
   deve lasciare geometrie vecchie o perdere il veicolo.
2. Separare risorse statiche da veicolo/camera. Conservare render come ingresso
   compatibile che usa il nuovo percorso. Per il prototipo e' ammesso ricomporre
   i layer statici quando il set cambia; stesso set/versione non alloca nuovi
   Graphics. Non aggiornare il mondo statico in updateVehicle.
3. Preservare ordinamento globale di strade/edifici, mask inverse e hole.
   Non usare un Container per chunk che alteri l'ordine globale dei layer;
   se viene usato, dimostrare con test che un edificio non copre una strada
   del vicino. Gestire id chunk e sostituzione della revisione senza duplicati.
4. Esporre cameraBounds in coordinate locali e teardown idempotente.
   Resize aggiorna scala/bounds senza spostare la pose nel mondo. Distruggere
   le risorse possedute senza invalidare risorse condivise del renderer.

## Accettazione

- [ ] AC1: aggiunta/rimozione/sostituzione/vuoto preservano auto, pose, label e
  camera; nessuna allocazione statica per aggiornamenti equivalenti.
- [ ] AC2: geometrie, hole, mask e ordine di disegno rimangono corretti su
  chunk adiacenti; le risorse rimosse e dispose non lasciano oggetti vivi.
- [ ] AC3: cameraBounds riflette dimensioni e inversione Y dopo resize;
  V0 continua a renderizzare e rispondere a guida/L/F3 senza regressioni.

## Verifica

`npm run test:run -- src/render/pixi`

`npm run test:e2e -- tests/e2e/bootstrap.spec.ts tests/e2e/renderer-streaming.spec.ts`

Gate comune e Chrome a 1280x720/390x844. La prova di aggiornamento puo' usare
un harness browser di test con chunk sintetici, senza aggiungere controlli
di mutazione all'API debug di produzione. Ispezionare screenshot e canvas
non vuoto, non soltanto snapshot DOM o un mock di Graphics.

## Handoff

Documentare firme finali, definizione di set equivalente, possesso delle
risorse e misura della camera. ONLINE-10 deve sapere applicare/rimuovere
chunk e distruggere la sessione senza ricreare il veicolo.
