# CACHE-02: Esperimento IndexedDB

**Stato:** completato. Log: `tasks/executions/2026-09-11-CACHE-02.md`.
**Dipendenze:** CACHE-01.
**Persona:** fullstack-developer.
**Taglia:** M, 4 file di codice/test.

## Obiettivo

Implementare `IndexedDbChunkStore` dietro il contratto e misurarne
write/read/deserialize, quota e modalita' di fallimento su payload compilati
reali (fixture). Decisione documentata: se i numeri non giustificano la
complessita', si chiude con la motivazione e il contratto resta pronto. I
test deterministici usano lo store in-memory; l'IndexedDB reale solo nei
test browser/E2E con fixture.

## READ

- `src/world/chunk/persistent.ts`, `src/fixtures/geo/lecce-sant-oronzo-v0.raw.json`,
  `docs/testing/benchmark-protocol-v0.md`, C-CACHE.

## MAY MODIFY / DO NOT TOUCH

Modificabili: nuovo modulo e test. Non cambiare il contratto senza
riallineare CACHE-01/03/04; nessuna scrittura automatica senza consenso live.

## Esecuzione TDD

1. Test RED (browser): put/get di un chunk compilato roundtrip identico
  (JSON stringify confronto); store bloccato -> errore tipizzato.
2. Implementare; test GREEN con fake-indexeddb o E2E reale.
3. Misure con ambiente dichiarato; decisione nel log.

## Accettazione

- [x] AC1: roundtrip fedele (featureId, collisioni, diagnostica inclusi).
- [x] AC2: misure write/read/quota con ambiente e metodo dichiarati.
- [x] AC3: decisione documentata (adotta/rimanda) con numeri.

## Verifica

`npm run test:run -- src/world/chunk/persistent.test.ts` +
E2E dedicato + gate comune.

## Handoff

CACHE-03 valida le entry prima dell'uso; la sessione resta funzionante
senza storage.
