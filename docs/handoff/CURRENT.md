# Punto di ingresso corrente

Data: 2026-08-26

Questo file sostituisce `CODEX-START-HERE.md` come avvio di sessione.

I file `PRE-CODE-COMPLETE.md`, `CODEX-START-HERE.md`,
`CODEX-EXECUTION-QUEUE.md` e `docs/execution/` restano archivio della coda V0.
Non rieseguirli come backlog corrente.

## Stato delle fasi

| Fase | Stato |
|---|---|
| 0 Documentazione e contratti | Completata — `docs/results/PHASE-0-COMPLETE.md` |
| 0B Esperimenti stack V0 | Assorbita dall'evidenza V0 / ADR-001–005 |
| 1 Vertical slice V0 | Eseguita, review con remediation richiesta |
| 2+ Streaming, cache, live geo, packager, AI | Non aperte |

## Gate di qualità corrente

La review end-to-end del 2026-08-25 ha avuto esito iniziale `REQUEST CHANGES`.
La remediation R1–R8 è stata completata il 2026-08-26:

- report: `docs/analysis/END-TO-END-CODE-REVIEW-2026-08-25.md`;
- evidenza operativa: `tasks/executions/2026-08-25-end-to-end-code-review.md`.
- remediation: `docs/analysis/IMPORTANT-FINDINGS-REMEDIATION-2026-08-26.md`;
- esecuzione: `tasks/executions/2026-08-26-important-findings-remediation.md`.

Il V0 è tecnicamente consolidato per una nuova review del gate. Phase 2 non è
ancora aperta: serve approvazione umana del piano e dei criteri di accettazione.

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

## Prossima fase di prodotto

La prossima tranche è la fondazione Open World definita in
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
composizione multi-chunk e adapter HTTP live. Resta P3.4, la decisione su
provider, consenso e attivazione live in prodotto. AI e multiplayer restano
fuori scope.

## Comandi

Vedi `AGENTS.md` e `README.md`.

## Convenzione attiva di repository

- `docs/` contiene analisi, decisioni, contratti e risultati.
- `tasks/` contiene piano attivo, checklist e log di esecuzione.
