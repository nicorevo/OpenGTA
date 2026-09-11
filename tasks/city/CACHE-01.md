# CACHE-01: Contratto storage persistente

**Stato:** completato. Log: `tasks/executions/2026-09-11-CACHE-01.md`.
**Dipendenze:** Nessuna.
**Persona:** fullstack-developer.
**Taglia:** S, 3 file di codice/test.

## Obiettivo

Definire `PersistentChunkStore` astratto (`get/put/delete/clear/quota` con
errori tipizzati) e una implementazione in-memory per i test. La chiave
riusa il namespace della warm cache esistente (origine, cell size, provider,
profilo query, compiler/schema version) e non contiene segreti. Il runtime
deve funzionare identicamente con storage assente.

## READ

- `src/world/chunk/cache.ts`, `src/world/runtime/open-world.ts` (namespace),
  `tasks/online/FOLLOW-UPS.md` (NEXT-03), C-CACHE in `tasks/city/README.md`.

## MAY MODIFY / DO NOT TOUCH

Modificabili: nuovo modulo `src/world/chunk/persistent.ts` e test. Non
modificare la warm cache esistente ne' il namespace calcolato in questa
slice (la chiave va riusata, non duplicata).

## Esecuzione TDD

1. Test RED: get su store vuoto -> miss tipizzato; put/get roundtrip;
   quota esaurita -> errore esplicito senza dati persi.
2. Implementare contratto + in-memory; test GREEN.
3. Test: chiave include le versioni (due versioni = due entry).

## Accettazione

- [x] AC1: contratto testato con errori tipizzati e roundtrip.
- [x] AC2: chiave = namespace + versioni; nessun segreto possibile.
- [x] AC3: nessuna dipendenza browser nel contratto (testabile in Node).

## Verifica

`npm run test:run -- src/world/chunk/persistent.test.ts` + gate comune.

## Handoff

CACHE-02 implementa IndexedDB dietro il contratto; CACHE-03 la validazione.
