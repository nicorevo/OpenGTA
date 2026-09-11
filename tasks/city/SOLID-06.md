# SOLID-06: SECURITY.md riallineato e gate di consistenza documentale

**Stato:** pianificato.
**Dipendenze:** Nessuna.
**Persona:** security-auditor.
**Taglia:** S, 2 file di documentazione.

## Obiettivo

Aggiornare `SECURITY.md`: rimuovere l'affermazione obsoleta ("il repository
non contiene ancora un'applicazione eseguibile") e allineare il threat model
alle superfici reali: coordinate/URL/consenso utente, payload OSM e
ReadableStream, normalizzatore/compiler, chunk cache (e futura IndexedDB),
canvas/render, WASM Rapier, eventuale Web Worker, telemetria, hosting/CSP.
Definire un piccolo documentation consistency gate da eseguire nelle
milestone (checklist di frasi di stato vs codice).

## READ

- `SECURITY.md`, `docs/results/ONLINE-RUNTIME-RESULT.md`, `README.md`,
  `docs/adr/ADR-007-public-osm-service-boundaries.md`, `ADR-009`.

## MAY MODIFY / DO NOT TOUCH

Modificabili: SECURITY.md, `docs/process/` (gate). Non cambiare codice.
Non promettere SLA o certificazioni.

## Esecuzione

1. Elencare le superfici effettive dal codice (grep dei punti di ingresso).
2. Riscrivere le sezioni obsolete; aggiungere la checklist del gate
   (stato fasi, baseline, claim di sicurezza) da eseguire prima delle release.
3. Verifica: nessuna affermazione falsa residua; link interni risolti.

## Accettazione

- [ ] AC1: nessuna frase obsoleta; threat model copre le superfici reali.
- [ ] AC2: gate di consistenza documentato ed eseguibile in < 15 min.
- [ ] AC3: diff di soli documenti; nessun codice toccato.

## Verifica

`git diff --check` + grep mirati su frasi di stato; gate comune N/A
(solo documentazione, dichiarato nel log).

## Handoff

CITY-02 riesegue il gate prima della chiusura; il canary CITY-01 rispetta i
confini di sicurezza qui dichiarati.
