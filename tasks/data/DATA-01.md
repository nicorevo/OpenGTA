# DATA-01: Fallback Overpass di sviluppo

**Stato:** pianificato. **Dipendenze:** DATA-00. **Persona:** fullstack-developer. **Taglia:** S.

## Obiettivo
Misura di continuita' per lo sviluppo (NON la soluzione finale): se il
default Overpass fallisce per network/5xx persistente, si passa a un
secondario configurato (es. mirror raggiungibile), rispettando: nessun
round-robin aggressivo, 429 con Retry-After senza saltare subito server,
nessuna query parallela a piu' provider, abort senza ulteriori tentativi.
Identity della cache distinta per endpoint servente.

## READ
`src/world/runtime/source.ts` (createOverpassGeoDataSource), DATA-00, ADR-007.

## MAY MODIFY / DO NOT TOUCH
Modificabili: source e test, config di progetto (lista endpoint). Non
cambiare scheduler/retry core, policy di produzione (allowlist), UI.

## TDD
1. RED: con primario network-fail persistente e secondario valido, la
   risposta arriva dal secondario; con 429+Retry-After NON si salta.
2. Implementare `fallbackEndpoints` (dev) nel loader Overpass: esauriti i
   retry sul primario per cause network/5xx, si prova il secondario; 429
   mai scavalca; identity per endpoint.
3. GREEN + gate.

## Accettazione
- [ ] AC1: network/5xx persistente passa al secondario; 429 rispettato.
- [ ] AC2: nessuna query parallela a piu' provider; abort interrompe tutto.
- [ ] AC3: cache namespace distinto per endpoint; suite verde.

## Verifica
`npm run test:run -- src/world/runtime/source.test.ts` + gate comune.

## Handoff
Il fallback resta solo sviluppo: DATA-11 rende la source MVT il percorso
primario sperimentale.
