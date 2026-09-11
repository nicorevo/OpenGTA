# CACHE-03: Versioning e integrità della cache persistente

**Stato:** pianificato.
**Dipendenze:** CACHE-02.
**Persona:** fullstack-developer.
**Taglia:** S, 3 file di codice/test.

## Obiettivo

Validazione prima dell'uso: entry con schema/compiler version incompatibili,
payload corrotto o firma non verificabile = discard esplicito, mai uso
silenzioso. Il caricamento da cache deve essere indistinguibile da un miss
gestito (refetch pulito). La chiave versionata di CACHE-01 resta l'unica
fonte di identita'.

## READ

- `src/world/chunk/persistent.ts`, `src/world/compiler/compiled.ts`
  (schemaVersion), `src/world/runtime/open-world.ts` (compilerVersion),
  C-CACHE.

## MAY MODIFY / DO NOT TOUCH

Modificabili: modulo persistent e test. Non cambiare lo schema canonico;
il bump di compilerVersion deve bastare a invalidare.

## Esecuzione TDD

1. Test RED: entry scritta con versione vecchia -> get la scarta e
  restituisce miss; JSON corrotto -> miss, nessun throw incontrollato.
2. Implementare la validazione; test GREEN.
3. Test: entry valida della versione corrente -> hit.

## Accettazione

- [ ] AC1: entry incompatibile/corrotta scartata, mai usata.
- [ ] AC2: refetch pulito dopo discard; nessun errore non gestito.
- [ ] AC3: hit valido verificato; suite verde.

## Verifica

`npm run test:run -- src/world/chunk/persistent.test.ts` + gate comune.

## Handoff

CACHE-04 definisce budget ed eviction sulle entry valide.
