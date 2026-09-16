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

## Online Recovery Tranche (implemented)

La tranche di ripristino online e' implementata e verificata (ONLINE-01..16,
checkpoint C1..C6): acquisizione live con retry rispettosi, avvio progressivo,
streaming durante la guida, confinamento fisico, payload limitati, ingresso
live esplicito e gate finale con misure.

- Risultato con matrice e limiti:
  [ONLINE-RUNTIME-RESULT](../results/ONLINE-RUNTIME-RESULT.md).
- Evidenza: [analisi online](analysis/ONLINE-RUNTIME-ANALYSIS-2026-09-08.md).
- Contratti e procedura delle slice: [tasks/online/README.md](../tasks/online/README.md).
- Schede consegnate: ONLINE-01..16 in `tasks/online/`, log in
  `tasks/executions/`, stato in [tasks/plan.md](../tasks/plan.md) e
  [tasks/todo.md](../tasks/todo.md).

La spec di Fase 2 resta riferimento della fondazione precedente; hosting,
cache persistente, pacchetti, AI e multiplayer non sono impliciti nella
tranche e restano nei filoni differiti di `tasks/online/FOLLOW-UPS.md`.

## Active Feature Specs

- First-person renderer (OutRun-style perspective): `docs/specs/first-person-renderer-v0.md`
