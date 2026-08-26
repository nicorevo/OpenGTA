# Analisi stato repository — 2026-08-25

## Obiettivo del riordino

Rendere coerente il repository con le regole di `AGENTS.md`:

- `docs/` contiene analisi, specifiche, contratti e decisioni;
- `tasks/` contiene piano, backlog operativo ed esecuzioni;
- i file storici restano disponibili ma non devono essere rieseguiti come coda
  attiva.

## Stato osservato

### Coerenze già presenti

- L'intento di prodotto è esplicito in `docs/intent/open-gta-web.md`.
- Le decisioni chiuse e quelle aperte sono separate in `docs/DECISIONS.md`.
- L'architettura è indicizzata in `docs/architecture/README.md`.
- Il risultato V0 e la chiusura di Fase 0 sono documentati in `docs/results/`.
- `SECURITY.md` esiste ed è coerente con il perimetro browser/geodata.

### Incoerenze rilevate prima del riordino

1. `tasks/` mancava, nonostante `AGENTS.md` lo richieda come sede del piano.
2. `CODING-STANDARDS.md` era referenziato da più documenti ma assente.
3. `docs/execution/` conteneva sia piani storici sia backlog percepibile come
   operativo, in conflitto con la convenzione richiesta per `tasks/`.
4. I punti di ingresso principali non esplicitavano abbastanza la separazione
   tra documentazione strutturale e lavoro esecutivo corrente.

## Decisioni operative di riordino

- `docs/execution/` viene trattata come archivio storico di pianificazione ed
  esecuzione V0.
- `tasks/` diventa la sede attiva per:
  - piano approvabile;
  - checklist operativa;
  - log di esecuzione per sessione o per tranche.
- `docs/SPEC.md` diventa l'indice di specifica corrente richiesto dal ciclo di
  vita.
- `CODING-STANDARDS.md` viene ripristinato come documento autorevole minimo.

## Implicazioni per il prossimo ciclo di sviluppo

- Prima di aprire Fase 2 bisogna approvare un nuovo piano in `tasks/plan.md`.
- Ogni nuova esecuzione non deve più introdurre backlog operativo in `docs/`.
- I documenti storici V0 restano fonte di contesto, non istruzioni attive.

## Aggiornamento dopo review tecnica

Il riordino ha consolidato il processo, non certificato il comportamento del
codice. La successiva review end-to-end ha esito `REQUEST CHANGES` e sostituisce
qualsiasi interpretazione di questo documento come approvazione tecnica della
baseline.

Riferimenti correnti:

- `docs/analysis/END-TO-END-CODE-REVIEW-2026-08-25.md`;
- `tasks/executions/2026-08-25-end-to-end-code-review.md`;
- `docs/handoff/CURRENT.md`.

## File aggiornati dal riordino

- `AGENTS.md`
- `README.md`
- `docs/SPEC.md`
- `docs/architecture/README.md`
- `docs/handoff/CURRENT.md`
- `docs/execution/README.md`
- `tasks/README.md`
- `tasks/plan.md`
- `tasks/todo.md`
- `tasks/executions/2026-08-25-project-rebaseline.md`
