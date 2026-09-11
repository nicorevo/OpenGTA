# DATA-00: Classificare i fallimenti della source live

**Stato:** completato. Log: `tasks/executions/2026-09-11-DATA-00.md`. **Dipendenze:** Nessuna. **Persona:** fullstack-developer. **Taglia:** S.

## Obiettivo
Diagnostica developer senza cambiare la semantica runtime: categoria errore
(gia' codificata), host endpoint, chunk id, tentativi, durata, categoria
browser se disponibile. MAI payload completo, coordinate non necessarie o
token nei log. L'overlay F3 e `__opengtaV0Debug` devono esporre i dati.

## READ
`src/world/runtime/source.ts`, `source-error.ts`, `src/app/runtime-session.ts`,
`src/app/bootstrap.ts` (overlay), test relativi.

## MAY MODIFY / DO NOT TOUCH
Modificabili: source (diagnostica per-source), sessione (snapshot), overlay
bootstrap, test. Non cambiare compiler/normalizer/renderer/fisica/chunk grid.

## TDD
1. RED: snapshot senza campi diagnostici; overlay senza errori per cella.
2. Implementare `diagnostics()` sulla source (host, categoria ultima,
   tentativi, durataMs, status) e `source` nella snapshot di sessione +
   riga errori nell'overlay (codice per cella).
3. GREEN + gate.

## Accettazione
- [x] AC1: network/timeout/abort/http/rate-limit/invalid-response/
  response-too-large restano distinguibili in diagnostica.
- [x] AC2: host, tentativi, durata e categoria visibili in overlay/debug.
- [x] AC3: nessun payload/token nei log; suite verde.

## Verifica
`npm run test:run -- src/world/runtime src/app/runtime-session.test.ts` + gate comune.

## Handoff
DATA-01 usa la diagnostica per verificare il fallback.
