# CITY-01: Canary live reale (Lecce + lista estesa)

**Stato:** pianificato.
**Dipendenze:** SOLID-01..06, ZOOM-05.
**Persona:** test-engineer.
**Taglia:** M, 3 file di test/config.

## Obiettivo

Suite `tests/canary/` separata dalla CI deterministica: avvio manuale o
nightly contro provider reale su coordinate dichiarate (Lecce centro per
prima; poi Taranto, Milano, Roma, Parigi, una zona a geometria semplice e
una con multipolygon complessi). Verifica: provider raggiungibile, payload
valido, normalizzazione completa, P0 giocabile, N chunk disponibili,
collisioni applicate, zero uncaught/NaN/chunk bloccato. Report con
data/endpoint/esito separati; il fallimento del provider non rende rossa la
suite normale; richieste limitate e nessuna rotazione di mirror.

## READ

- `docs/results/ONLINE-RUNTIME-RESULT.md` (limiti provider),
  `docs/adr/ADR-007-public-osm-service-boundaries.md`, C-CANARY,
  `tests/fixtures/live-world.ts` (pattern fixture).

## MAY MODIFY / DO NOT TOUCH

Modificabili: nuova suite, script npm opzionale (`test:canary`), documenti
di risultato. Non includere la canary nel webServer/CI default; non cambiare
il criterio di passaggio dei test deterministici.

## Esecuzione

1. Scrivere la suite con coordinate parametrizzabili e timeout generosi.
2. Eseguire su Lecce; registrare esito nel log con data/endpoint.
3. Documentare il comando di avvio e la frequenza consigliata (manuale/
   weekly); nessun dato live committato.

## Accettazione

- [ ] AC1: canary eseguita su Lecce con esito registrato e separato.
- [ ] AC2: il fallimento provider non tocca CI/suite normale.
- [ ] AC3: lista estesa pronta e documentata; nessuna richiesta selvaggia.

## Verifica

`npm run test:canary -- tests/canary/lecce.spec.ts` (comando nuovo) +
gate comune sui test deterministici.

## Handoff

CITY-02 usa il report canary come evidenza separata della matrice.
