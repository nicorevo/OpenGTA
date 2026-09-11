# SOLID-05: Long-drive regression

**Stato:** completato. Log: `tasks/executions/2026-09-11-SOLID-05.md`.
**Dipendenze:** SOLID-04.
**Persona:** test-engineer.
**Taglia:** M, 3 file di test.

## Obiettivo

Una prova di guida virtuale con 100+ cambi finestra (avanti, indietro, loop,
diagonale, inversioni rapide) a clock simulato: nessun crash, nessuna
unhandled rejection, nessuno stale apply, memoria/cache/active/collider
bounded, nessun ingresso in celle non applicate, risorse renderer rilasciate.
Estende il test di 100 finestre della tranche precedente al percorso
completo con il renderer incrementale.

## READ

- `src/app/runtime-session.test.ts`, `src/world/runtime/open-world.test.ts`,
  `src/physics/rapier/adapter.test.ts`, log ONLINE-08/12.

## MAY MODIFY / DO NOT TOUCH

Modificabili: test di sessione/runtime. Non cambiare il motore per rendere
verdi le asserzioni; un fallimento e' un bug da riportare al task
responsabile con riproduzione.

## Esecuzione TDD

1. Estendere il percorso: 3000+ passi avanti, inversione, loop diagonale;
   asserzioni su snapshot a intervalli regolari.
2. Osservare ROSSO se un contatore sfora (record/cache/collider/pending).
3. Fissare il difetto nel modulo responsabile (con riproduzione minima) e
   registrare il caso nel log; test GREEN stabile.

## Accettazione

- [x] AC1: 100+ transizioni senza crash/unhandled rejection/stale apply.
- [x] AC2: record <= limite, cache <= 9, collider bounded, pending <= 32.
- [x] AC3: nessun ingresso in celle non applicate; guardia sempre attiva.

## Verifica

`npm run test:run -- src/app/runtime-session.test.ts
src/world/runtime/open-world.test.ts` + gate comune.

## Handoff

Il percorso diventa il letto di regressione per ZOOM-04 (zoom durante la
guida) e per il gate CITY-02.
