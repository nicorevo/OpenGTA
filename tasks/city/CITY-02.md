# CITY-02: Gate City Drive Stable

**Stato:** pianificato.
**Dipendenze:** Tutti i task della tranche.
**Persona:** test-engineer.
**Taglia:** M, documentazione di risultato e verifiche complete.

## Obiettivo

Chiudere la milestone con evidenze: matrice requisiti→prove della spec
(`docs/specs/city-drive-stable.md`), misure con ambiente dichiarato
(headless per regressioni, profili DESKTOP_LOW/MID reali per esperienza),
cold/warm con cache persistente, report canary separato, SECURITY gate
rieseguito e handoff/piano/checklist concordi col codice. Nessun deploy o
SLA dichiarato.

## READ

- Spec e ADR della tranche, log di tutti i task, `docs/handoff/CURRENT.md`,
  `docs/results/ONLINE-RUNTIME-RESULT.md` (formato risultato).

## MAY MODIFY / DO NOT TOUCH

Modificabili: `docs/results/CITY-DRIVE-STABLE-RESULT.md` (nuovo), handoff,
README (stato/comandi verificati), piano/checklist (checkbox). Nessuna
modifica al motore per rendere verdi le asserzioni: un fallimento riapre il
task responsabile con riproduzione.

## Esecuzione

1. Eseguire gate completo: typecheck, suite completa, E2E, build, smoke
  dist, canary Lecce.
2. Compilare la matrice requisiti→prove; dichiarare limiti residui.
3. Misure finali (zoom per livello, long-drive, cold/warm con cache
  persistente) con ambiente e metodo.

## Accettazione

- [ ] AC1: matrice completa con prove passate; zero dipendenze dai servizi
  pubblici nei test deterministici.
- [ ] AC2: misure con ambiente dichiarato e limiti espliciti; canary
  separata dalla CI.
- [ ] AC3: risultato, handoff, piano e checklist concordi col codice;
  nessun task incompleto marcato chiuso.

## Verifica

`npm run typecheck` + `npm run test:run` + `npm run build` +
`OPENGTA_E2E_PORT=<libera> npm run test:e2e` + smoke dist + canary.

## Handoff

Consegnata la milestone, il backlog differito (traffico, pedoni, missioni,
produzione) resta in `tasks/online/FOLLOW-UPS.md` con le condizioni di
apertura aggiornate se i risultati le modificano.
