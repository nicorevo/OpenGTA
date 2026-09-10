# Punto di ingresso corrente

Data: 2026-09-10

Questo file sostituisce `CODEX-START-HERE.md` come avvio di sessione.

I file `PRE-CODE-COMPLETE.md`, `CODEX-START-HERE.md`,
`CODEX-EXECUTION-QUEUE.md` e `docs/execution/` restano archivio della coda V0.
Non rieseguirli come backlog corrente.

## Stato delle fasi

| Fase | Stato |
|---|---|
| 0 Documentazione e contratti | Completata — `docs/results/PHASE-0-COMPLETE.md` |
| 0B Esperimenti stack V0 | Assorbita dall'evidenza V0 / ADR-001–005 |
| 1 Vertical slice V0 | Implementata; remediation R1-R8 completata |
| 2 Fondazione Open World | Implementata; difetti del live riprodotti e aperti |
| Ripristino online | ONLINE-01..12 completati e verificati (C1..C4); ONLINE-13..16 in corso |
| 3 Packager, AI, multiplayer | Non aperte |

## Gate di qualità corrente

La review end-to-end del 2026-08-25 ha avuto esito iniziale `REQUEST CHANGES`.
La remediation R1–R8 è stata completata il 2026-08-26:

- report: `docs/analysis/END-TO-END-CODE-REVIEW-2026-08-25.md`;
- evidenza operativa: `tasks/executions/2026-08-25-end-to-end-code-review.md`.
- remediation: `docs/analysis/IMPORTANT-FINDINGS-REMEDIATION-2026-08-26.md`;
- esecuzione: `tasks/executions/2026-08-26-important-findings-remediation.md`.

Le verifiche della baseline e i commit atomici sono registrati negli execution
log del 2026-08-26. Non certificano l'affidabilita' online: l'analisi dell'8
settembre ha riprodotto mondo vuoto, neighbor scartati e assenza di streaming
anche con suite verde.

## Lavoro corrente

- Analisi: [ONLINE-RUNTIME-ANALYSIS-2026-09-08.md](../analysis/ONLINE-RUNTIME-ANALYSIS-2026-09-08.md).
- Piano: [tasks/plan.md](../../tasks/plan.md).
- Checklist: [tasks/todo.md](../../tasks/todo.md).
- Ingresso esecutore: [tasks/online/README.md](../../tasks/online/README.md).
- Stato: ONLINE-01..12 completati con log in `tasks/executions/`;
  checkpoint C1..C4 superati: il prototipo live e' giocabile con streaming.
  Prossimo task nell'ordine previsto:
  [ONLINE-13](../../tasks/online/ONLINE-13.md).

La pianificazione e' stata richiesta il 2026-09-08 e completata il 2026-09-09.
L'esecuzione procede per schede: ogni consegna e' registrata nel proprio log
con evidenze reali; un esecutore riceve il task da svolgere e usa scheda,
contratti comuni e log dei prerequisiti, senza ricostruire la conversazione
originale.

I precedenti piano/checklist completati sono archiviati in `tasks/archive/`.
Non usare `docs/execution/` o la vecchia coda V0 come lavoro da ripetere.

## Lettura minima prima di modificare il prodotto

1. `AGENTS.md`
2. `.opencode/agents/AGENTS.md` e solo le skill pertinenti
3. `CODING-STANDARDS.md`, `SECURITY.md`
4. `docs/intent/open-gta-web.md`
5. `docs/SPEC.md`
6. `docs/DECISIONS.md`
7. `docs/architecture/README.md`
8. `tasks/plan.md`, `tasks/todo.md`
9. ADR e spec citati dal task

## Fondazione precedente

La tranche implementata è la fondazione Open World definita in
`docs/specs/open-world-runtime-phase-2.md`. P2.1 è completata e documentata in
`tasks/executions/2026-08-26-p2-1-chunk-grid.md`; anche P2.2, lifecycle locale
dei chunk, è completata e documentata in
`tasks/executions/2026-08-26-p2-2-chunk-lifecycle.md`; anche P2.3, active window
e seam geometriche locali, è completata e documentata in
`tasks/executions/2026-08-26-p2-3-active-window.md`; anche P2.4, warm cache
in-memory, è completata e documentata in
`tasks/executions/2026-08-26-p2-4-warm-cache.md`; anche P2.5, boundary di
acquisizione runtime, è completata e documentata in
`tasks/executions/2026-08-26-p2-5-runtime-source.md`; anche P2.6, integrazione
della fondazione Open World Runtime, è completata e documentata in
`tasks/executions/2026-08-26-p2-6-open-world-runtime.md`. Le estensioni P3.1–P3.3
sono state completate e registrate in
`tasks/executions/2026-08-26-open-world-expansion.md`: partizione/ownership,
composizione multi-chunk e adapter HTTP live. P3.4 è definita in
`docs/adr/ADR-009-live-runtime-consent.md`: provider-neutral, endpoint esplicito
e consenso opt-in; il fixture offline resta il default. AI e multiplayer
restano fuori scope. Il piano ONLINE corrente definisce i successivi task con
obiettivi e criteri propri; il completamento storico della fondazione non
sostituisce le verifiche dei nuovi flussi.

## Comandi

Vedi `AGENTS.md` e `README.md`.

## Convenzione attiva di repository

- `docs/` contiene analisi, decisioni, contratti e risultati.
- `tasks/` contiene piano attivo, checklist e log di esecuzione.
