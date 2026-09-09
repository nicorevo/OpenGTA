# Implementation Plan: Post-V0 Rebaseline

## Overview

Il repository ha già completato documentazione di Fase 0 e vertical slice V0.
Prima di ripartire con nuovo sviluppo, il lavoro necessario è ristabilire una
base operativa coerente: specifica indicizzata, standard presenti, distinzione
chiara tra documentazione strutturale e task esecutivi, e un piano minimo per
la prossima fase.

## Architecture Decisions

- `docs/` resta la sede di analisi, contratti, ADR e risultati.
- `tasks/` diventa la sede corrente per piano, backlog e log di esecuzione.
- `docs/execution/` resta archivio storico V0, non backlog attivo.

## Task List

### Phase 1: Process Rebaseline
- [x] Ripristinare i documenti di processo mancanti (`CODING-STANDARDS.md`,
  `docs/SPEC.md`).
- [x] Scrivere un'analisi di stato che espliciti coerenze, incoerenze e
  convenzioni attive.
- [x] Creare `tasks/` come workspace operativo.

### Checkpoint: Process Rebaseline
- [x] Le fonti di verità sono esplicite.
- [x] La separazione `docs/` vs `tasks/` è documentata.

### Phase 2: Restart Preparation
- [x] Riesaminare il codice V0 rispetto ai documenti aggiornati.
- [x] Eseguire suite, build, audit e verifica browser del percorso V0.
- [x] Documentare finding e gate in
  `docs/analysis/END-TO-END-CODE-REVIEW-2026-08-25.md`.
- [x] Correggere ricostruzione ring/multipolygon e completare gli error-path test.
- [x] Preservare gli hole in rendering e collisione.
- [x] Modellare il clipping di polyline multi-part prima del multi-chunk.
- [x] Correggere freno e metriche fixed-step con test di regressione.
- [x] Riallineare collision contract e diagnostics del compiler.
- [x] Sostituire lo smoke placeholder con una prova bootstrap/browser ripetibile.
- [x] Rieseguire il gate tecnico con working tree organizzato in commit atomici.
- [x] Definire il piano di Fase 2 in slice verificabili.
- [x] Aprire e completare le slice implementative dopo approvazione del piano.

### Checkpoint: Restart Ready
- [x] Finding Important della review chiusi; esito in
  `docs/analysis/IMPORTANT-FINDINGS-REMEDIATION-2026-08-26.md`.
- [x] Suite e browser smoke controllano il percorso end-to-end.
- [x] Piano Fase 2 approvato e implementato fino alla policy live opt-in.
- [x] Contesto operativo chiaro per la prossima sessione.

### Phase 3: Open World Runtime Foundation

Spec normativa proposta: `docs/specs/open-world-runtime-phase-2.md`.

- [x] P2.1 Definire identità, griglia e bounds deterministici dei chunk.
- [x] P2.2 Implementare lifecycle in-memory con loader iniettato.
- [x] P2.3 Implementare active window e test delle seam geometriche locali.
- [x] P2.4 Aggiungere warm cache in-memory con eviction bounded.
- [x] P2.5 Definire boundary di acquisizione runtime con fake source.
- [x] P2.6 Integrare la fondazione Open World Runtime e lo smoke E2E con source
  deterministica iniettata.

### Phase 4: Open World Completion

- [x] P3.1 Definire ownership e partizione geometrica delle feature attraversanti.
- [x] P3.2 Comporre e renderizzare la finestra multi-chunk attiva.
- [x] P3.3 Aggiungere adapter HTTP live dietro `GeoDataSource`.
- [x] P3.4 Definire policy provider-neutral, consenso opt-in e attivazione live
  in `docs/adr/ADR-009-live-runtime-consent.md`.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Confondere storico V0 con backlog attivo | High | Marcatura esplicita di `docs/execution/` come archivio |
| Ripartire senza standard o spec indicizzata | High | Ripristino di `CODING-STANDARDS.md` e `docs/SPEC.md` |
| Aprire Fase 2 senza evidenza condivisa | Medium | Tenere il gate in `docs/handoff/CURRENT.md` e `tasks/todo.md` |
| Suite verde ma contratti non coperti | High | Remediation guidata dai finding R1–R8 e nuova review |

## Open Questions

- Quale slice esatto deve aprire la Fase 2: lifecycle chunk, seam test locale o
  attivazione/disattivazione chunk?
