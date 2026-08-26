# Execution Log: P2.3 Active Window

**Data:** 2026-08-26
**Obiettivo:** calcolare la finestra locale e verificare seam geometriche.

## Implementazione

- Aggiunto `src/world/chunk/window.ts` come modulo puro.
- Il chunk corrente riceve priorità `P0`.
- Il chunk nella direzione della velocità riceve `P1`.
- I chunk coperti dai bounds della camera ricevono `P2`.
- Le richieste duplicate vengono accorpate mantenendo la priorità migliore e
  l’ordine row-major stabile.
- `sharedSeam` identifica confini verticali e orizzontali adiacenti e rifiuta
  chunk separati o solo tangenti.

## Verifiche

- `npm run test:run -- src/world/chunk/window.test.ts`: PASS — 3 test.
- `npm run typecheck`: PASS.
- `npm run test:run`: PASS — 17 file, 64 test.
- `npm run build`: PASS; warning noto sul chunk PixiJS principale.

## Limite dichiarato

La policy di ownership delle feature che attraversano un confine non è ancora
implementata; sarà parte della partizione/compiler slice successiva.
