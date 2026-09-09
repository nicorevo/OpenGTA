# ONLINE-06: Cancellare e rilasciare record del lifecycle

**Stato:** pianificato.
**Dipendenze:** nessuna.
**Persona:** fullstack-developer.
**MODEL CLASS:** STANDARD. **REASONING:** high.
**Taglia:** S, 2 file di codice/test.
**Finding:** parte lifecycle di F6.

## Obiettivo

Rilasciare un chunk deve eliminare il record e il riferimento al valore
compilato, anche con caricamento pendente. Un completamento obsoleto non deve
ricreare il record o sostituire un caricamento nuovo della stessa chiave.
Questo task non collega ancora l'eviction alla finestra del giocatore.

## READ

- Letture comuni e C-RUNTIME in [README](README.md).
- `src/world/chunk/lifecycle.ts`, `src/world/chunk/lifecycle.test.ts`.
- `src/world/runtime/open-world.ts`, `src/world/chunk/cache.ts` (sola lettura).

## MAY MODIFY / DO NOT TOUCH

Modificabili: `src/world/chunk/lifecycle.ts` e `src/world/chunk/lifecycle.test.ts`.
Non modificare source, cache, renderer, fisica o bootstrap. Non aggiungere
event bus, storage persistente o nuove dipendenze.

## Esecuzione TDD

1. Riprodurre carica -> attiva -> disattiva -> release e verificare assenza
   del record e del valore da get/records. Release ripetuto e dispose ripetuto
   non lanciano. Non rilasciare implicitamente altri chunk.
2. Introdurre contesto del loader con AbortSignal posseduto dal lifecycle
   e priorita' numerica facoltativa. I loader attuali che accettano solo key
   restano compatibili. Load concorrenti sulla stessa chiave si deduplicano;
   cancel riguarda il caricamento condiviso e termina tutti i waiter.
3. Testare release mentre il loader ignora abort, poi load della stessa key
   prima che il vecchio lavoro termini. Risolvere prima il nuovo e poi il
   vecchio: solo il nuovo puo' restare. Non basarsi soltanto su un contatore
   generation che riparte da zero quando si ricrea un Entry.
4. Preservare reload con valore precedente valido quando fallisce il refresh.
   Dispose termina waiter/record, non lascia unhandled rejection; i lavori
   non cancellabili possono finire fisicamente ma non mutano piu' il lifecycle.

## Accettazione

- [ ] AC1: release elimina record/valore, e release/dispose sono idempotenti;
  i metodi non trattengono tutti i chunk gia' visitati.
- [ ] AC2: cancel, dispose e loader non cooperativo terminano le promesse
  pubbliche; risultati precedenti a release+reload non riappaiono.
- [ ] AC3: deduplicazione, attivazione/disattivazione e fallback sul precedente
  valore dopo refresh fallito mantengono i contratti gia' testati.

## Verifica

`npm run test:run -- src/world/chunk/lifecycle.test.ts src/world/runtime/open-world.test.ts`

Gate comune. Usare deferred promise e fake timer, con asserzioni su stato e
risultati, senza affidarsi al garbage collector per dimostrare il rilascio.

## Handoff

Indicare firme finali load/reload/context/cancel/release/dispose, comportamento
dei waiter e protezione dall'Entry obsoleto. ONLINE-08 colleghera' queste
operazioni a desired set, source e callback di applicazione dei chunk.
