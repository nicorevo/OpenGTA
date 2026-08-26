# Coding Standards

## Scope

Queste convenzioni valgono per il codice applicativo, i test e la
documentazione operativa del repository.

## General Rules

- Preferisci cambi piccoli e focalizzati.
- Non introdurre dipendenze senza una necessità esplicita e una traccia
  documentale adeguata.
- Mantieni ASCII come default nei file di codice e configurazione.
- Non committare segreti, artefatti temporanei, cache o output runtime.

## TypeScript

- `strict` resta obbligatorio.
- Evita `any`; usa tipi espliciti o `unknown` con narrowing.
- Modella i contratti ai confini del sistema con tipi dedicati.
- Preferisci funzioni pure nei moduli di trasformazione geodata e compiler.
- Mantieni l'inversione delle dipendenze descritta in
  `docs/architecture/v0-repository-layout.md`.

## Module Boundaries

- `src/geo` non importa `src/render` o `src/physics`.
- `src/world` non importa `src/render` o `src/physics`.
- `src/render` consuma solo dati compilati o contratti di progetto.
- `src/physics` resta dietro adapter di progetto; niente dipendenze sparse da
  Rapier fuori dai boundary previsti.
- `src/gameplay` non dipende da tag OSM o strutture raw del provider.

## Tests

- Per codice nuovo o modificato, aggiungi o aggiorna test vicini al modulo
  quando possibile.
- Usa fixture deterministici committati; nessuna dipendenza dalla rete nei test.
- Quando un bug viene corretto, aggiungi una protezione di regressione se il
  bug è riproducibile in test.

## Documentation

- Le decisioni, i contratti e le analisi restano in `docs/`.
- Piani, backlog di lavoro e log di esecuzione restano in `tasks/`.
- Aggiorna i documenti indice quando cambia il flusso operativo del progetto.

## Verification

Per ogni task non banale:

1. esegui almeno la suite pertinente;
2. esegui `npm run typecheck` quando il codice TypeScript cambia;
3. esegui `npm run build` quando cambiano path runtime o bundling;
4. controlla `git diff` e `git status --short` prima di chiudere il task.
