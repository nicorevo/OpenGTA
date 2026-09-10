# Tasks Workspace

Questa cartella contiene il materiale operativo attivo del progetto.

## Convenzioni

- `plan.md`: piano approvabile e ordinato per slice verticali.
- `todo.md`: checklist sintetica derivata dal piano.
- `online/`: schede ONLINE-01..16, contratti comuni e template di consegna.
- `executions/`: log delle esecuzioni effettuate.
- `archive/`: copie dei piani e delle checklist gia' completati.

## Regola di separazione

- `docs/`: analisi, decisioni, architettura, specifiche, risultati.
- `tasks/`: esecuzione corrente e prossime tranche di lavoro.

## Stato attuale

Il lavoro corrente e' il ripristino online e lo streaming, basato sull'analisi
dell'8 settembre 2026. ONLINE-01..10 sono completati e verificati (checkpoint
C1..C3 superati); i log sono in `executions/`. Prossimo task nell'ordine
previsto: [ONLINE-11](online/ONLINE-11.md). Partire da [plan.md](plan.md),
[todo.md](todo.md) e [online/README.md](online/README.md).

Ogni scheda contiene dipendenze, letture, file modificabili, passi TDD,
accettazione, comandi e handoff per un esecutore senza il contesto della chat.
La [checklist](todo.md) va aggiornata solo dopo le verifiche della scheda.

La fondazione V0/P2/P3 precedentemente completata e' preservata in
[archive/2026-08-26-plan.md](archive/2026-08-26-plan.md) e
[archive/2026-08-26-todo.md](archive/2026-08-26-todo.md), insieme ai log esistenti.
Non rieseguire quei task come backlog corrente.
