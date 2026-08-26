# Execution Log: P2.2 Chunk Lifecycle

**Data:** 2026-08-26
**Obiettivo:** implementare il lifecycle in-memory con loader iniettato.

## Implementazione

- Aggiunto `src/world/chunk/lifecycle.ts` come componente generico indipendente
  dal runtime grafico e dalla fisica.
- Implementati gli stati `ABSENT`, `COMPILING`, `READY`, `ACTIVE` e
  `INACTIVE`, con transizioni esplicite per load, activate e deactivate.
- Aggiunta deduplicazione delle richieste in-flight e `reload` forzato.
- I risultati con generation obsoleta vengono ignorati.
- Un reload fallito ripristina il valore e lo stato precedenti per chunk pronti,
  attivi o inattivi.

## Verifiche

- `npm run test:run -- src/world/chunk/lifecycle.test.ts`: PASS — 5 test.
- `npm run typecheck`: PASS.
- `npm run test:run`: PASS — 16 file, 61 test.
- `npm run build`: PASS; warning noto sul chunk PixiJS principale.

## Scope escluso

La slice non gestisce ancora active window, priorità, cache, persistenza o
acquisizione geografica; seguiranno P2.3–P2.6.
