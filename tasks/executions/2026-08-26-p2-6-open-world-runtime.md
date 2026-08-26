# Execution Log: P2.6 Open World Runtime Integration

**Data:** 2026-08-26
**Obiettivo:** integrare la fondazione Open World nel runtime applicativo.

## Implementazione

- Aggiunto `src/world/runtime/open-world.ts` per comporre grid, active window,
  lifecycle, cache e `GeoDataSource`.
- Il chunk `P0` viene caricato e attivato prima dei vicini.
- I vicini vengono caricati progressivamente; un errore neighbor non invalida
  il chunk giocabile.
- Il bootstrap supporta `?mode=open-world&lat=<lat>&lon=<lon>` e usa la stessa
  pipeline normalize/compile del V0.
- Aggiunto smoke E2E dedicato alla modalità Open World.
- Playwright riusa il server locale e avvia un server isolato in CI.

## Verifiche

- `npm run test:run`: PASS — 20 file, 77 test.
- `npm run test:e2e`: PASS — 2 test Chrome.
- `npm run typecheck`: PASS.
- `npm run build`: PASS; warning noto sul chunk PixiJS principale.

## Limiti dichiarati

La modalità usa ancora il fixture Lecce tramite source deterministica iniettata;
non effettua richieste OSM pubbliche. Il rendering applicativo visualizza il
chunk P0, mentre il coordinator prepara i vicini. Una sorgente geografica live
e la composizione visuale multi-chunk richiedono task successivi.
