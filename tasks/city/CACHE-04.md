# CACHE-04: Budget ed eviction della cache persistente

**Stato:** pianificato.
**Dipendenze:** CACHE-03.
**Persona:** fullstack-developer.
**Taglia:** S, 3 file di codice/test.

## Obiettivo

Budget dichiarato (default conservativo, configurabile internamente) con
eviction LRU delle entry valide e gestione della quota IndexedDB piena:
la scrittura che supera il budget evicita o fallisce in modo esplicito
senza corrompere lo store. Contatori hit/miss/evicted esposti in snapshot
per l'overlay.

## READ

- `src/world/chunk/persistent.ts`, `src/world/chunk/cache.ts` (pattern LRU),
  C-CACHE.

## MAY MODIFY / DO NOT TOUCH

Modificabili: modulo persistent e test. Non cambiare il contratto pubblico;
il default numerico non e' una promessa di servizio.

## Esecuzione TDD

1. Test RED: oltre il budget la scrittura evicita la entry LRU; quota piena
  -> errore esplicito e store consistente.
2. Implementare; test GREEN.
3. Test: contatori hit/miss/evicted coerenti su sequenza nota.

## Accettazione

- [ ] AC1: budget rispettato con eviction LRU deterministica.
- [ ] AC2: quota piena gestita senza corruzione; sessione funziona senza
  storage.
- [ ] AC3: contatori in snapshot; suite verde.

## Verifica

`npm run test:run -- src/world/chunk/persistent.test.ts` + gate comune.

## Handoff

Chiude la Fase D: CITY-02 misura cold/warm con cache persistente.
