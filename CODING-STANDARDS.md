# Standard di progetto

## Stato

Queste regole valgono indipendentemente dallo stack. Convenzioni specifiche per
linguaggio, framework, test runner e package manager verranno aggiunte nello
stesso incremento che introdurrà lo scaffolding applicativo, dopo una decisione
tecnica esplicita.

## Principi generali

- Implementa fette verticali piccole, verificabili e reversibili.
- Usa TDD quando viene aggiunto o modificato un comportamento.
- Preferisci la soluzione più semplice che soddisfa il requisito corrente.
- Non introdurre astrazioni, dipendenze o sistemi destinati soltanto a bisogni
  ipotetici futuri.
- Mantieni ogni file entro 500 righe; oltre questa soglia rivaluta le
  responsabilità del modulo.
- Commenta il perché di una scelta non ovvia, non ciò che il codice esprime già.
- Non lasciare codice commentato, debug output o TODO privi di contesto e
  criterio di chiusura.

## Lingua e nomi

- Usa l'italiano per la documentazione di prodotto e di progetto.
- Usa l'inglese per identificatori, tipi, API, nomi dei moduli e messaggi
  destinati agli sviluppatori.
- Scegli nomi che descrivano il dominio; evita abbreviazioni non condivise.
- Codifica i file in UTF-8, con terminatore di riga LF e newline finale.

## Contratti e confini

- Tratta input utente, risposte di servizi esterni, dati OpenStreetMap, asset e
  messaggi di rete come non attendibili.
- Valida forma, dimensione e intervalli dei dati nel punto in cui attraversano
  un confine del sistema.
- Mantieni distinti dati geografici globali, coordinate locali di rendering e
  stato della simulazione; le conversioni devono avere contratti espliciti.
- Definisci e testa i messaggi scambiati tra main thread e worker come
  interfacce pubbliche interne.
- Propaga errori strutturati con cause osservabili; non ignorare eccezioni o
  fallimenti parziali.

## Prestazioni

- Definisci budget misurabili prima di ottimizzare: frame time, memoria,
  latenza di caricamento e dimensione dei dati.
- Misura su hardware e dataset di riferimento documentati.
- Non spostare lavoro in un worker senza misurare costo, trasferimenti e
  sincronizzazione.
- Introduci cache, pooling e strutture spaziali soltanto con una strategia di
  invalidazione e una prova del beneficio.

## Dipendenze e asset

- Ogni nuova dipendenza richiede una motivazione, una verifica della licenza e
  una valutazione di manutenzione, sicurezza e impatto sul bundle.
- Usa un solo package manager e un solo lockfile autorevole per workspace,
  quando verranno scelti.
- Blocca gli script di installazione non revisionati durante il bootstrap delle
  dipendenze.
- Documenta provenienza, licenza e processo riproducibile per texture, modelli e
  altri asset generati o importati.
- Non inserire segreti, credenziali o dati personali nel repository o negli
  asset.

## Verifica

- Esegui test, lint, type-check e build nativi del progetto quando disponibili.
- Per le modifiche al rendering o al runtime browser, verifica anche il
  comportamento in un browser reale.
- Per le modifiche prestazionali, allega misure prima e dopo su uno scenario
  riproducibile.
- Controlla `git diff`, `git diff --check` e `git status --short` prima di
  dichiarare completato il lavoro.
- Non includere build output, cache, report locali, credenziali o altri
  artefatti runtime.

## Decisioni

Le proposte contenute in una bozza non costituiscono uno standard. Registra come
ADR le scelte costose da invertire soltanto dopo aver documentato contesto,
alternative, conseguenze e prova di validazione.
