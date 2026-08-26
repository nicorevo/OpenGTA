# Execution Log: P3.4 Live Activation Policy

**Data:** 2026-08-26
**Obiettivo:** definire l’attivazione live senza vincolare il core a un provider.

## Decisione

- Provider-neutral `GeoDataSource`.
- Endpoint HTTP/HTTPS esplicito.
- Provider OSM opzionale via Overpass (`provider=osm`) con query POST bbox.
- Consenso obbligatorio tramite `consent=1`.
- Fixture offline come default.
- Policy endpoint e UI di consenso definitiva demandate al prodotto.

Decisione registrata in `docs/adr/ADR-009-live-runtime-consent.md`.

## Verifiche

- `npm run test:run`: PASS — 21 file, 84 test.
- `npm run test:e2e`: PASS — 3 test Chrome.
- `npm run typecheck`: PASS.
- `npm run build`: PASS; warning noto sul chunk PixiJS principale.

## Configurazione OSM

Il percorso è disponibile con:

`/?mode=open-world-live&provider=osm&lat=40.35&lon=18.17&consent=1`

L’endpoint predefinito è `https://overpass-api.de/api/interpreter`; le richieste
dei vicini sono serializzate e sottoposte a rate limit. Le risposte `429/503`
transitorie vengono ritentate con backoff; gli errori definitivi sono mostrati
all’utente senza Promise non gestite.
