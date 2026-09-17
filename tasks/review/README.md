# RV: Code Review Remediation — contratti e procedura

Fonte: review complessiva del 2026-09-17 (baseline `ae92e10`).
Piano: [plan.md](../plan.md). Checklist: [todo.md](../todo.md).

## Procedura per ogni task

1. Leggere la scheda: obiettivo, READ, MAY MODIFY / DO NOT TOUCH, TDD, AC.
2. TDD: RED (test fallente) → GREEN (codice minimo) → gate comune.
3. Gate comune: `npm run typecheck`, `npm run test:run`, `npm run build`.
   Ai checkpoint (R-A, R-B, R-C) anche `npm run test:e2e`.
4. Commit atomico con messaggio imperativo.
5. Log con evidenza (test, gate) in `tasks/executions/2026-09-17-RV-XX.md`.
6. Aggiornare la riga in plan.md e in todo.md.

## Invarianti da non rompere

- `src/geo` e `src/world` non importano `app`/`render`/`physics`.
- I dati non fidati (MVT, OSM, IndexedDB) restano bounded e validati ai confini.
- La persistenza resta best-effort: i fallimenti sono catturati, mai crash.
- Nessuna nuova dipendenza runtime.
- `SECURITY.md` resta allineato al codice (gate di consistenza documentale).
- L'interfaccia `VectorTileProvider` non cambia (RV-04: le modifiche restano
  dentro il provider).
