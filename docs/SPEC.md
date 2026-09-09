# OpenGTA Web Specification Index

Ultimo riallineamento: 2026-09-09

Questo file soddisfa la regola `DEFINE FIRST` di `AGENTS.md` e indica la
specifica corrente senza duplicare tutti i contratti già scritti.

## Product Baseline

- Intento di prodotto: `docs/intent/open-gta-web.md`
- Registro decisioni: `docs/DECISIONS.md`
- Stato corrente del progetto: `docs/handoff/CURRENT.md`

## Architecture

- Indice architettura: `docs/architecture/README.md`
- ADR: `docs/adr/README.md`

## Prototype Scope in Force

Lo scope eseguibile comprende il vertical slice V0 e la fondazione Open World.
La presenza del percorso live non implica che sia affidabile: i difetti
riprodotti sono documentati nell'analisi online citata sotto. Riferimenti:

- `docs/results/V0-RESULT.md`
- `docs/specs/`
- `docs/testing/`

## Execution Discipline

- I piani attivi sono in `tasks/plan.md`.
- La checklist operativa corrente è in `tasks/todo.md`.
- I log di esecuzione di sessione vivono in `tasks/executions/`.

## Next Planned Product Phase

La tranche corrente e' pianificata in [tasks/plan.md](../tasks/plan.md):
ripristino dell'acquisizione live, avvio progressivo, streaming durante la
guida e robustezza del prototipo. Non e' ancora implementata.

- Evidenza: [analisi online](analysis/ONLINE-RUNTIME-ANALYSIS-2026-09-08.md).
- Contratti e procedura delle slice: [tasks/online/README.md](../tasks/online/README.md).
- Schede eseguibili: ONLINE-01..16, collegate dal piano e dalla checklist.

Gli obiettivi e i criteri di ogni scheda soddisfano DEFINE FIRST per il task
assegnato; i contratti descrivono il comportamento da implementare, non lo
stato attuale. Gli ADR coinvolti saranno aggiornati nei task che li cambiano.
La spec di Fase 2 resta riferimento della fondazione precedente; hosting,
cache persistente, pacchetti, AI e multiplayer non sono impliciti nella tranche.
