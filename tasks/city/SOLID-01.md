# SOLID-01: Metriche compiler reali

**Stato:** completato. Log: `tasks/executions/2026-09-11-SOLID-01.md`.
**Dipendenze:** Nessuna.
**Persona:** fullstack-developer.
**Taglia:** S, 3 file di codice/test.

## Obiettivo

Eliminare `stageDurationsMs: { total: 0 }` fittizio: misurare con
`performance.now()` almeno acquisition (source), decode (reader), normalize e
compile, piu' apply render/fisica gia' parzialmente coperti dalla sessione.
Nessuna metrica sempre zero; l'overlay F3 deve mostrare valori reali.

## READ

- `src/world/compiler/compiled.ts`, `src/world/runtime/source.ts`,
  `src/world/runtime/response-reader.ts`, `src/app/runtime-session.ts`,
  `src/app/bootstrap.ts` (updateOverlay), `src/app/metrics.ts`.
- `docs/testing/benchmark-protocol-v0.md`.

## MAY MODIFY / DO NOT TOUCH

Modificabili: compiler, source, reader, sessione e relativi test.
Non cambiare i contratti compilati ne' la semantica di rete. Non sommare
tempi di rete a tempi CPU: registrare fasi separate.

## Esecuzione TDD

1. Test RED: un chunk compilato da fixture deve avere
   `stageDurationsMs.total > 0` e chiavi per normalize/compile numeriche.
2. Implementare misurazione reale attorno ai punti di ingresso; propagare i
   tempi di acquisition/decode dalla source nel request context.
3. Test GREEN; verificare overlay con sessione reale (non valori 0.0).

## Accettazione

- [x] AC1: nessuna durata fittizia; total e fasi misurati con unit test.
- [x] AC2: overlay `compile:` mostra il tempo reale dell'ultimo chunk.
- [x] AC3: benchmark aggiornato riporta valori reali con ambiente dichiarato.

## Verifica

`npm run test:run -- src/world/compiler src/world/runtime/source.test.ts
src/app/runtime-session.test.ts` + gate comune + E2E misurazioni.

## Handoff

SOLID-02 usa le fasi misurate per verificare che la cancellazione riduca il
lavoro utile; i benchmark SOLID-03 si basano su queste metriche.
