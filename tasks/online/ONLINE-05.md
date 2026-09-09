# ONLINE-05: Aggiornare collider senza ricreare il mondo fisico

**Stato:** pianificato.
**Dipendenze:** nessuna.
**Persona:** fullstack-developer.
**MODEL CLASS:** STANDARD. **REASONING:** high.
**Taglia:** M, circa 4 file di codice/test.
**Finding:** prerequisito fisico di F3/F6 e spawn.

## Obiettivo

La fisica deve applicare e rilasciare collider statici per chunk durante la
guida, preservando body dinamico, pose e velocita'. Oggi i collider sono creati
una volta sola nella factory. Questo task aggiunge anche la sagoma fisica
condivisa necessaria allo spawn e al controllo di disponibilita'.

## READ

- Letture comuni e C-RESOURCES in [README](README.md).
- `src/physics/rapier/adapter.ts`, `src/physics/rapier/adapter.test.ts`.
- `src/world/compiler/compiled.ts`, `src/world/compiler/partition.ts`, `src/world/compiler/partition.test.ts`.
- `src/gameplay/vehicle/controller.ts`, `src/world/model/types.ts`.
- Tipi locali della versione installata di Rapier prima di usare query/remove API.

## MAY MODIFY / DO NOT TOUCH

Modificabili: adapter e test; `src/gameplay/vehicle/shape.ts` e `src/gameplay/vehicle/shape.test.ts`
(nuovi, solo geometria di progetto). Non cambiare tuning del controller,
visual scale del renderer, formula di clipping o gestione rete. Rapier resta
importato esclusivamente nell'adapter fisico.

## Esecuzione TDD

1. Creare un veicolo e applicare chunk A/B con muri diversi: identita' del body,
   pose e velocita' devono restare invariate durante gli aggiornamenti statici.
   Rimuovere A, riapplicare B, sostituire B: verificare conteggi esatti e assenza
   di collider duplicati. Una barriera rimossa non deve continuare a bloccare.
2. Gestire gli handle per chunk e frammento. Due chunk possono contenere lo
   stesso featureId con frammenti diversi: rimuoverne uno non rimuove l'altro.
   Conservare le API V0 e inizializzare le shapes legacy nello stesso sistema
   di ownership, senza duplicarle quando si passa a un nuovo insieme.
3. Esportare in shape.ts sagoma fisica e calcolo della sua impronta ruotata
   (semilati attuali 2 e 0,82 m). Adapter, spawn e guardia devono consumare
   questa fonte unica. Aggiungere una query di progetto per verificare se una
   pose interseca collider statici, escludendo il body dell'auto stessa.
4. Conservare hole, muri concavi, capsule/segmenti/circoli gia' supportati.
   Un aggiornamento fallito deve ripulire i nuovi handle parziali e preservare
   i precedenti. Esporre dispose idempotente e statistiche numeriche utili
   senza far dipendere runtime/cache da oggetti Rapier.

## Accettazione

- [ ] AC1: add/remove/replace sono idempotenti, preservano veicolo e dinamica,
  e il numero di collider corrisponde solo a statici attivi piu' l'auto.
- [ ] AC2: collisioni, cortili e frammenti condivisi restano corretti;
  un errore non cancella il mondo precedente, dispose libera tutte le risorse.
- [ ] AC3: sagoma autorevole centralizzata e query di spazio libero testata
  con pose ruotate, sovrapposizione a muro e auto esclusa dalla query.

## Verifica

`npm run test:run -- src/physics/rapier/adapter.test.ts src/gameplay/vehicle/shape.test.ts`

Gate comune e `npm run test:e2e -- tests/e2e/bootstrap.spec.ts` per la
compatibilita' della guida. Le prove fisiche usano Rapier reale e timestep
fisso; non limitarsi a contare chiamate mock a createCollider/removeCollider.

## Handoff

Riportare API di aggiornamento/rimozione/rollback, query di spazio libero,
sagoma e semantica colliderCount. Sblocca ONLINE-09 e ONLINE-11; il commit
coordinato con la scena sara' implementato nella sessione ONLINE-10.
